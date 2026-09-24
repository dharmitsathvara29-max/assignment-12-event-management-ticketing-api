const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authenticate = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { bookingRateLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket booking, cancellation, and retrieval
 */

/**
 * @swagger
 * /api/tickets/book:
 *   post:
 *     summary: Book tickets for an event (Rate Limited & Atomic)
 *     tags: [Tickets]
 *     description: Attendee only. Books tickets atomically using Firestore runTransaction. Rate limited to 10 requests per minute per user to prevent scalping bots.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, quantity, attendeeName, attendeeEmail]
 *             properties:
 *               eventId:
 *                 type: string
 *                 example: event_techconf_2026
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 2
 *               attendeeName:
 *                 type: string
 *                 example: Kunal Sharma
 *               attendeeEmail:
 *                 type: string
 *                 format: email
 *                 example: kunal@gmail.com
 *     responses:
 *       201:
 *         description: Tickets booked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Tickets booked successfully
 *                 data:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Insufficient tickets, past event, or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — only attendees can book tickets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Too many booking requests (Rate limit exceeded)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Too many booking requests, slow down.
 */
router.post(
  '/book',
  authenticate,
  checkRole('attendee'),
  bookingRateLimiter,
  ticketController.bookTicket
);

/**
 * @swagger
 * /api/tickets/my-tickets:
 *   get:
 *     summary: View purchased tickets
 *     tags: [Tickets]
 *     description: Attendee only. Returns all tickets purchased by the authenticated user, sorted by most recent first.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of purchased tickets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 2
 *                     tickets:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ticket'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — attendees only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/my-tickets',
  authenticate,
  checkRole('attendee'),
  ticketController.getMyTickets
);

/**
 * @swagger
 * /api/tickets/{id}/cancel:
 *   post:
 *     summary: Cancel a booked ticket and restore inventory
 *     tags: [Tickets]
 *     description: Attendee only. Cancels a booked ticket and atomically restores the event's availableTickets inventory via a Firestore transaction.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID to cancel
 *         example: ticket_rec_88219
 *     responses:
 *       200:
 *         description: Ticket cancelled and inventory restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ticket TKT-2026-88219 cancelled successfully. 2 ticket(s) returned to inventory.
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId:
 *                       type: string
 *                     bookingRef:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: cancelled
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Ticket already cancelled or invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — not the owner of this ticket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/cancel',
  authenticate,
  checkRole('attendee'),
  ticketController.cancelTicket
);

module.exports = router;
