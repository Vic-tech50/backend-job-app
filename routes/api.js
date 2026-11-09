var express = require('express');
const db = require("../db"); //import database connection from db.js
const bcrypt = require("bcryptjs");
require("dotenv").config();
var router = express.Router();
const upload = require("../config/upload"); // Import multer configuration
const authenticateJWT = require('../middleware/jwt');


router.get('/fetchWorker', async (req, res) => {
     try {
    const [result] = await db.query("SELECT * FROM users ORDER BY id DESC");
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
})

router.get('/bookings/:client_id', async (req, res) => {
     try {
         const { client_id } = req.params;
         // Validate client ID.
        if (!client_id) {
            return res.status(400).json({
                status: false,
                message: "Client ID is required"
            });
        }

    const [result] = await db.query("SELECT * FROM bookings WHERE client_id = ? ORDER BY id DESC", [client_id]);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
})

router.post("/bookings", async (req, res) => {
  try {
    
    const { artisan_id, service, description, address, state, lga, preferred_date, preferred_time, budget, phone, client_id } = req.body;
    
    const date = new Date();
    const bookingid = Math.floor(1000000000 + Math.random() * 9000000000)

    await db.query("INSERT INTO bookings (artisan_id, client_id, service, description, address, state, lga, preferred_date, preferred_time, budget, phone, date, booking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      artisan_id, client_id, service, description, address, state, lga, preferred_date, preferred_time, budget, phone,date, bookingid

    ]);
  

    res.status(201).json({ message: "Booking Went Successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all bookings assigned to an artisan.
router.get("/artisan/bookings/:artisan_id", async (req, res) => {
    try {
        // Get artisan ID from URL.
        const { artisan_id } = req.params;

        // Fetch artisan bookings.
        const [result] = await db.query(
            `SELECT * FROM bookings
             WHERE artisan_id = ?
             ORDER BY id DESC`,
            [artisan_id]
        );

        // Return bookings.
        res.status(200).json({
            status: true,
            data: result
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: false,
            message: error.message
        });
    }
});


// Update a booking's status.
router.patch("/bookings/:id/status", async (req, res) => {
    try {
        // Get booking ID from URL.
        const { id } = req.params;

        // Get requested status.
        const { status } = req.body;

        // Only allow these status values.
        const allowedStatuses = ["accepted", "rejected","completed", "cancelled"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                status: false,
                message: "Invalid booking status."
            });
        }

        // Check whether booking exists.
        const [booking] = await db.query(
            "SELECT * FROM bookings WHERE id = ?",
            [id]
        );

        if (booking.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Booking not found."
            });
        }

        // Only pending bookings can be accepted or rejected.
        // if (booking[0].status !== "pending") {
        //     return res.status(400).json({
        //         status: false,
        //         message: "This booking has already been processed."
        //     });
        // }

        // Update booking status.
        await db.query(
            "UPDATE bookings SET status = ? WHERE id = ?",
            [status, id]
        );

        return res.status(200).json({
            status: true,
            message: `Booking ${status} successfully.`
        });

    } catch (error) {
        console.error("Update booking error:", error);

        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
});
 

// authMiddleware
router.get("/getbookingsdetails/:id", authenticateJWT, async (req, res) => {
  try {
    // Get the booking ID from the URL.
    const { id } = req.params;

    // Get the logged-in artisan's ID from authentication.
    const artisanId = req.user.id;

    // Fetch the booking and the customer's information.
    const [rows] = await db.query(
      `SELECT
        b.*,
        u.fullname AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone
       FROM bookings b
       LEFT JOIN users u ON b.client_id = u.id
       WHERE b.id = ? AND b.artisan_id = ?
       LIMIT 1`,
      [id, artisanId]
    );

    // Check whether the booking exists and belongs to this artisan.
    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Booking not found."
      });
    }

    // Return the booking details.
    return res.status(200).json({
      status: true,
      data: rows[0]
    });

  } catch (error) {
    console.error("Fetch booking details error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to retrieve booking details."
    });
  }
});







   

module.exports = router;
