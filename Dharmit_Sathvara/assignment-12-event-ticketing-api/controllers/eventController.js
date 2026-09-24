const { db } = require('../config/firebaseConfig');

/**
 * GET /api/events
 * Public. List events with eventDate in the future.
 * Supports ?category= and ?city= query filters.
 */
exports.getEvents = async (req, res, next) => {
  try {
    const { category, city } = req.query;
    const now = new Date().toISOString();

    // Base query: only upcoming events (eventDate > now)
    let query = db.collection('events').where('eventDate', '>', now);

    // Apply category filter if provided
    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.orderBy('eventDate', 'asc').get();

    let events = snapshot.docs.map((doc) => doc.data());

    // Apply city filter client-side (Firestore doesn't support partial text search)
    if (city) {
      const cityLower = city.toLowerCase();
      events = events.filter((e) =>
        e.venue && e.venue.toLowerCase().includes(cityLower)
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        count: events.length,
        events,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:id
 * Public. Return a single event with current availableTickets. 404 if not found.
 */
exports.getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eventDoc = await db.collection('events').doc(id).get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: eventDoc.data(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/events
 * Protected — Organizer only.
 * Creates a new event. Sets organizerId from JWT, availableTickets = totalCapacity.
 */
exports.createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      eventDate,
      venue,
      ticketPrice,
      totalCapacity,
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !eventDate || !venue || ticketPrice == null || !totalCapacity) {
      return res.status(400).json({
        success: false,
        message:
          'All fields are required: title, description, category, eventDate, venue, ticketPrice, totalCapacity',
      });
    }

    // Validate types
    if (typeof ticketPrice !== 'number' || ticketPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'ticketPrice must be a non-negative number',
      });
    }
    if (!Number.isInteger(totalCapacity) || totalCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'totalCapacity must be a positive integer',
      });
    }

    // Validate eventDate is in the future
    const eventDateObj = new Date(eventDate);
    if (isNaN(eventDateObj.getTime()) || eventDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'eventDate must be a valid ISO date string in the future',
      });
    }

    const eventRef = db.collection('events').doc();
    const now = new Date().toISOString();

    const newEvent = {
      id: eventRef.id,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      eventDate: eventDateObj.toISOString(),
      venue: venue.trim(),
      organizerId: req.user.id,
      ticketPrice,
      totalCapacity,
      availableTickets: totalCapacity,
      createdAt: now,
    };

    await eventRef.set(newEvent);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: newEvent,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/events/:id
 * Protected — Organizer only, must own the event.
 * Updates allowed event fields. 403 if not owner. 404 if not found.
 */
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eventRef = db.collection('events').doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${id}' not found`,
      });
    }

    const eventData = eventDoc.data();

    // Check ownership
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only update events you created.',
      });
    }

    // Build allowed update fields
    const allowedFields = ['title', 'description', 'category', 'eventDate', 'venue', 'ticketPrice'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate eventDate if provided
    if (updates.eventDate) {
      const d = new Date(updates.eventDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'eventDate must be a valid ISO date string',
        });
      }
      updates.eventDate = d.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update',
      });
    }

    updates.updatedAt = new Date().toISOString();
    await eventRef.update(updates);

    const updatedDoc = await eventRef.get();

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: updatedDoc.data(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/events/:id
 * Protected — Organizer only, must own the event.
 * Deletes the event document and cascade-cancels related confirmed tickets.
 */
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eventRef = db.collection('events').doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${id}' not found`,
      });
    }

    const eventData = eventDoc.data();

    // Check ownership
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only delete events you created.',
      });
    }

    // Cascade-cancel all confirmed tickets for this event
    const ticketsSnapshot = await db
      .collection('tickets')
      .where('eventId', '==', id)
      .where('status', '==', 'confirmed')
      .get();

    const batch = db.batch();
    ticketsSnapshot.docs.forEach((ticketDoc) => {
      batch.update(ticketDoc.ref, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: 'Event deleted by organizer',
      });
    });

    // Delete the event
    batch.delete(eventRef);
    await batch.commit();

    return res.status(200).json({
      success: true,
      message: `Event '${eventData.title}' deleted successfully. ${ticketsSnapshot.size} ticket(s) cascade-cancelled.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/events/:id/attendees
 * Protected — Organizer only, must own the event.
 * Returns all confirmed tickets (attendee name, email, quantity) for the event.
 */
exports.getEventAttendees = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eventDoc = await db.collection('events').doc(id).get();

    if (!eventDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${id}' not found`,
      });
    }

    const eventData = eventDoc.data();

    // Check ownership
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only view attendees for your own events.',
      });
    }

    const ticketsSnapshot = await db
      .collection('tickets')
      .where('eventId', '==', id)
      .where('status', '==', 'confirmed')
      .get();

    const attendees = ticketsSnapshot.docs.map((doc) => {
      const t = doc.data();
      return {
        ticketId: t.id,
        bookingRef: t.bookingRef,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        quantity: t.quantity,
        totalPaid: t.totalPaid,
        bookedAt: t.bookedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        event: {
          id: eventData.id,
          title: eventData.title,
          eventDate: eventData.eventDate,
          totalCapacity: eventData.totalCapacity,
          availableTickets: eventData.availableTickets,
          totalBooked: eventData.totalCapacity - eventData.availableTickets,
        },
        attendeeCount: attendees.length,
        attendees,
      },
    });
  } catch (err) {
    next(err);
  }
};
