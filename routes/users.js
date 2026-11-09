var express = require('express');
const db = require("../db"); //import database connection from db.js
const bcrypt = require("bcryptjs");
require("dotenv").config();
var router = express.Router();
const upload = require("../config/upload"); // Import multer configuration

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


// Update user profile and upload profile image.
router.post(
  "/updateprofile",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    try {
      // Get the submitted form fields.
      const {
        fullname,
        email,
        id,
        phoneNumber,
        dateOfBirth,
        gender,
        state,
        lga,
        streetAddress,
        bio,
      } = req.body;

      // Validate required fields.
      if (!id || !fullname?.trim() || !email?.trim()) {
        return res.status(422).json({
          success: false,
          message: "User ID, full name and email are required.",
        });
      }

      // Get the uploaded image.
      const image = req.files?.image?.[0];

     

// Update profile with a new image if one was uploaded.
if (image) {
  await db.query(
    `UPDATE users SET
      fullname = ?,
      email = ?,
      phone = ?,
      dob = ?,
      gender = ?,
      state = ?,
      lga = ?,
      street = ?,
      bio = ?,
      passport = ?
    WHERE id = ?`,
    [
      fullname.trim(),
      email.trim(),
      phoneNumber || null,
      dateOfBirth || null,
      gender || null,
      state || null,
      lga || null,
      streetAddress || null,
      bio || null,
      image.filename,
      id,
    ]
  );
} else {
  // No new image: keep the existing passport image.
  await db.query(
    `UPDATE users SET
      fullname = ?,
      email = ?,
      phone = ?,
      dob = ?,
      gender = ?,
      state = ?,
      lga = ?,
      street = ?,
      bio = ?
    WHERE id = ?`,
    [
      fullname.trim(),
      email.trim(),
      phoneNumber || null,
      dateOfBirth || null,
      gender || null,
      state || null,
      lga || null,
      streetAddress || null,
      bio || null,
      id,
    ]
  );
}

      // Check whether a user was updated.
      // if (result.affectedRows === 0) {
      //   return res.status(404).json({
      //     success: false,
      //     message: "User not found.",
      //   });
      // }

      // Return success response.
      return res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        // image: imageFile,
      });

    } catch (err) {
      // Print the actual error in your backend terminal.
      console.error("UPDATE PROFILE ERROR:", err);

      return res.status(500).json({
        success: false,
        message: "Unable to update profile.",
        error: err.message,
      });
    }
  }
);


router.post("/updatesecurity", async (req, res) => {
  try {
    
    const { currentPassword, newPassword, confirmPassword, id } = req.body;

      // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(422).json({
        success: false,
        message: "All fields are required"
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(422).json({
        success: false,
        message: "New password and confirm password do not match"
      });
    }

    const [existing] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, existing[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
 

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashed,
      id
    ]);
  

    res.status(201).json({ message: "User Password updated successfully \n Login With The New Password" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




router.post(
  "/workupload",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const {userid, title, description, status } = req.body;

      // Validate text fields
      if (!title || !description) {
        return res.status(422).json({
          success: false,
          message: "Title and description are required",
        });
      }

      // Validate image
      if (
        !req.files ||
        !req.files.image ||
        req.files.image.length === 0
      ) {
        return res.status(422).json({
          success: false,
          message: "Image is required",
        });
      }

      const imageFile = req.files.image[0].filename;

      // Check duplicate title
      const [existing] = await db.query(
        "SELECT id FROM works WHERE title = ?",
        [title]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Work title already exists",
        });
      }

      const workStatus = status || 1;
      const date = new Date();

      const [result] = await db.query(
        `INSERT INTO works
        (userid, image, title, description, status, date)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userid,
          imageFile,
          title,
          description,
          workStatus,
          date,
         
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Work uploaded successfully",
        workId: result.insertId,
        image: imageFile,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// Fetch all uploaded artisan works.
router.get("/fetchwork", async (req, res) => {
  try {
    // Get all uploaded works from the database.
    const [result] = await db.query(
      "SELECT * FROM works ORDER BY id DESC"
    );

    // Return the uploaded works.
    res.status(200).json({
      status: true,
      data: result.map((work) => ({
        ...work,

        // Convert the saved filename into an accessible URL.
        image: `${process.env.APP_URL}/uploads/${work.image}`,
      })),
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: false,
      message: "Unable to fetch uploaded works.",
    });
  }
});

// Fetch all records from database
// router.get('/fetchwork', async (req, res) => {
//      try {
//     const [result] = await db.query("SELECT * FROM works ORDER BY id DESC");
//     res.json(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send(error.message);
//   }
// })

 
  






   

module.exports = router;
