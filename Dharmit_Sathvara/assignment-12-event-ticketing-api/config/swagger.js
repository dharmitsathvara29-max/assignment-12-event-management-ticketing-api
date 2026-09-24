const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management & Ticketing API',
      version: '1.0.0',
      description:
        'A high-concurrency Event Ticketing REST API built with Node.js, Express, and Firebase Firestore. ' +
        'Features JWT role-based access control (Organizer vs Attendee), Firestore ACID transactions for ' +
        'atomic ticket booking, rate limiting against bot abuse, and full OpenAPI 3.0 documentation.',
      contact: {
        name: 'Dharmit Sathvara',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
      {
        url: 'https://event-ticketing-api.onrender.com',
        description: 'Production Server (Render)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'usr_abc123' },
            name: { type: 'string', example: 'Dharmit Sathvara' },
            email: { type: 'string', example: 'dharmit@example.com' },
            role: { type: 'string', enum: ['organizer', 'attendee'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'event_techconf_2026' },
            title: { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            description: { type: 'string', example: 'Annual flagship backend conference' },
            category: { type: 'string', example: 'Technology' },
            eventDate: { type: 'string', format: 'date-time', example: '2026-06-15T09:00:00Z' },
            venue: { type: 'string', example: 'Bandra Kurla Complex, Mumbai' },
            organizerId: { type: 'string', example: 'usr_organizer_01' },
            ticketPrice: { type: 'number', example: 1499 },
            totalCapacity: { type: 'integer', example: 500 },
            availableTickets: { type: 'integer', example: 482 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'ticket_rec_88219' },
            eventId: { type: 'string', example: 'event_techconf_2026' },
            eventTitle: { type: 'string', example: 'Global Cloud & AI Summit 2026' },
            userId: { type: 'string', example: 'usr_attendee_99' },
            attendeeName: { type: 'string', example: 'Kunal Sharma' },
            attendeeEmail: { type: 'string', example: 'kunal@gmail.com' },
            quantity: { type: 'integer', example: 2 },
            totalPaid: { type: 'number', example: 2998 },
            bookingRef: { type: 'string', example: 'TKT-2026-88219' },
            status: { type: 'string', enum: ['confirmed', 'cancelled'], example: 'confirmed' },
            bookedAt: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.js'), './routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
