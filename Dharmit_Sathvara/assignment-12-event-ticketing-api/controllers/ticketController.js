const { db } = require('../config/firebaseConfig');

/**
 * POST /api/tickets/book
 * Protected — Attendee only, rate limited (10 req/min).
 *
 * Uses a Firestore ACID transaction (db.runTransaction) to atomically:
 *   1. Read event and verify availability
 *   2. Decrement availableTickets
 *   3. Create the confirmed ticket document
 *
 * This guarantees tickets are NEVER oversold under concurrent traffic.
 */
exports.bookTicket = async (req, res, next) => {
  try {
    const { eventId, quantity, attendeeName, attendeeEmail } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!eventId || !quantity || !attendeeName || !attendeeEmail) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: eventId, quantity, attendeeName, attendeeEmail',
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity must be a positive integer',
      });
    }

    if (qty > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 tickets allowed per booking',
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(attendeeEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid attendee email format' });
    }

    const eventRef = db.collection('events').doc(eventId);
    const ticketRef = db.collection('tickets').doc();

    // ACID Transaction — atomic read-check-write
    const result = await db.runTransaction(async (t) => {
      const eventDoc = await t.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();

      // Check event is not in the past
      if (new Date(eventData.eventDate) <= new Date()) {
        throw new Error('Cannot book tickets for a past event');
      }

      if (eventData.availableTickets < qty) {
        throw new Error(
          `Insufficient tickets available. Requested: ${qty}, Available: ${eventData.availableTickets}`
        );
      }

      // Decrement availableTickets atomically
      t.update(eventRef, {
        availableTickets: eventData.availableTickets - qty,
      });

      // Build booking reference
      const bookingRef = `TKT-${Date.now().toString().slice(-6)}`;

      const newTicket = {
        id: ticketRef.id,
        eventId,
        eventTitle: eventData.title,
        userId,
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail.toLowerCase().trim(),
        quantity: qty,
        totalPaid: qty * eventData.ticketPrice,
        bookingRef,
        status: 'confirmed',
        bookedAt: new Date().toISOString(),
      };

      // Write ticket atomically
      t.set(ticketRef, newTicket);

      return newTicket;
    });

    return res.status(201).json({
      success: true,
      message: 'Tickets booked successfully',
      data: result,
    });
  } catch (err) {
    // Errors thrown inside the transaction are caught here
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/tickets/my-tickets
 * Protected — Attendee only.
 * Returns all tickets for the authenticated user, most recent first.
 */
exports.getMyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const snapshot = await db
      .collection('tickets')
      .where('userId', '==', userId)
      .orderBy('bookedAt', 'desc')
      .get();

    const tickets = snapshot.docs.map((doc) => doc.data());

    return res.status(200).json({
      success: true,
      data: {
        count: tickets.length,
        tickets,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/tickets/:id/cancel
 * Protected — Attendee only, must own the ticket.
 * Sets ticket status to 'cancelled' and restores event inventory via transaction.
 */
exports.cancelTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const ticketRef = db.collection('tickets').doc(id);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Ticket with ID '${id}' not found`,
      });
    }

    const ticketData = ticketDoc.data();

    // Ownership check
    if (ticketData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only cancel your own tickets.',
      });
    }

    // Already cancelled check
    if (ticketData.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This ticket is already cancelled',
      });
    }

    const eventRef = db.collection('events').doc(ticketData.eventId);
    const now = new Date().toISOString();

    // Transaction: cancel ticket + restore inventory atomically
    await db.runTransaction(async (t) => {
      const eventDoc = await t.get(eventRef);

      // Update ticket status
      t.update(ticketRef, {
        status: 'cancelled',
        cancelledAt: now,
      });

      // Restore inventory if event still exists
      if (eventDoc.exists) {
        const eventData = eventDoc.data();
        t.update(eventRef, {
          availableTickets: eventData.availableTickets + ticketData.quantity,
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: `Ticket ${ticketData.bookingRef} cancelled successfully. ${ticketData.quantity} ticket(s) returned to inventory.`,
      data: {
        ticketId: id,
        bookingRef: ticketData.bookingRef,
        status: 'cancelled',
        cancelledAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
};
