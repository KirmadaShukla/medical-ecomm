# Medical E-Commerce Platform

A TypeScript-based medical e-commerce platform built with Node.js, Express, and PostgreSQL.

## Features

- User management
- Product catalog
- Shopping cart
- Order processing
- Payment integration
- Inventory management

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Testing**: Jest
- **Documentation**: Swagger

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Update the values in `.env` as needed.

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

### Development

For development with auto-reload:
```bash
npm run dev
```

### Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── models/          # Data models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
└── index.ts         # Entry point
```

## API Endpoints

### User Management

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `JWT_SECRET` - JWT secret key

## License

This project is licensed under the MIT License.