import dotenv from 'dotenv';
dotenv.config(); 

// console.log('Stripe Key:', process.env.STRIPE_SECRET_KEY); 
// console.log('Database User:', process.env.DB_USER);

import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import Stripe from 'stripe';
import process from 'process';
import path from 'path';
import serverless from 'serverless-http';

const { Pool } = pkg;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Data Storage (In-Memory for Simplicity)
let rooms = [];

// API Endpoints

// Create Room
app.post('/api/rooms', (req, res) => {
  const { name, description } = req.body;
  const newRoom = { id: Date.now(), name, description };
  rooms.push(newRoom);
  res.json(newRoom); 
});

// Get All Rooms
app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// Get Specific Room
app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.find(r => r.id === parseInt(req.params.id));
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

// Book a Room
app.post('/api/booking', async (req, res) => {
  try {
    const { room_id, start_date, end_date, guest_name } = req.body;
    const result = await pool.query('INSERT INTO bookings (room_id, start_date, end_date, guest_name) VALUES ($1, $2, $3, $4) RETURNING *', [room_id, start_date, end_date, guest_name]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Payment Endpoint
app.post('/api/payment', async (req, res) => {
  const { amount, currency, paymentMethodId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
    });

    res.json({ paymentIntent });
  }catch (error) {
    console.error('Payment error:', error); // Log the complete error object

    if (error.type === 'StripeCardError') {
        res.status(402).json({ error: error.message });
    } else if (error.type === 'StripeInvalidRequestError') {
        res.status(400).json({ error: 'Invalid request parameters' });
    } else {
        res.status(500).json({ error: 'An error occurred during payment processing' });
    }
  }
});

module.exports.handler = serverless(app);

const buildPath = path.join(__dirname, '../frontend/dist'); // Correct path to dist
app.use(express.static(buildPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

const port = process.env.PORT || 3001; 
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
