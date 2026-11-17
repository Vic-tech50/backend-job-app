var express = require('express');
require("dotenv").config();
var router = express.Router();
const bcrypt = require("bcryptjs"); //To Hash The Password
const db = require("../db"); //import database connection from db.js
const moment = require('moment'); // npm install moment for diffForHuman date format()


router.get('/dashboard', function(req, res, next) {
  res.render('dashboard');
});

router.get('/profile', function(req, res) {
  res.render('admin/settings/profile')
});

router.post('/profile/update', async (req, res) => {
    try {
        // Check if the user is logged in
        if (!req.session.user) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/admin/login');
        }

        // Get the logged-in user's ID
        const { id } = req.session.user;

        // Get submitted form data
        let { name, email, phone } = req.body;

        // Validate required fields
        if (!name || !email || !phone) {
            req.flash('error', 'Please complete all required fields.');
            return res.redirect('back');
        }

        // Clean the submitted data
        name = name.trim();
        email = email.trim().toLowerCase();
        phone = phone.trim();

        // Check if the user exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE id = ? LIMIT 1',
            [id]
        );

        if (existing.length === 0) {
            req.flash('error', 'User account not found.');
            return res.redirect('back');
        }

        // Check if another user already uses this email
        const [emailExists] = await db.query(
            'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
            [email, id]
        );

        if (emailExists.length > 0) {
            req.flash('error', 'This email address is already in use.');
            return res.redirect('back');
        }

        // Update user profile
        await db.query(`
            UPDATE users
            SET
                fullname = ?,
                email = ?,
                phone = ?
            WHERE id = ?
        `, [
            name,
            email,
            phone,
            id
        ]);

        // Update the session with the new information
        req.session.user.name = name;
        req.session.user.email = email;
        req.session.user.phone = phone;

        req.flash('success', 'Profile updated successfully.');

        return res.redirect('back');

    } catch (err) {
        console.error('Profile Update Error:', err);

        req.flash('error', 'Unable to update profile. Please try again.');

        return res.redirect('back');
    }
});


router.post("/security", async (req, res) => {
  try {
    const { currentpassword, password, confirmpassword } = req.body;

    // ✅ 1. Get current logged-in user from session
    const user = req.session.user;
    const id = user.id;

    if (password !== confirmpassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('back');
    }

    // ✅ 2. Get the actual hashed password from the database
    const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [id]);
    if (rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('back');
    }

    const dbPassword = rows[0].password;

    // ✅ 3. Compare current password with the one in DB
    const validPassword = await bcrypt.compare(currentpassword, dbPassword);
    if (!validPassword) {
      req.flash('error', 'Invalid current password');
      return res.redirect('back');
    }

    // ✅ 4. Hash the new password before saving
    const hashedNewPassword = await bcrypt.hash(password, 10);

    // ✅ 5. Update in DB
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, id]);

    // ✅ 6. Optionally, destroy session to force re-login
    // Destroy the current session to force the user to log in again
req.session.destroy((err) => {
    if (err) {
        console.error('Session destroy error:', err);
        return res.redirect('/auth/login?error=session');
    }

    // Clear the session cookie
    res.clearCookie('connect.sid');

    // Redirect with a success message
    return res.redirect('/auth/login?success=password-updated');
});
    // req.session.destroy((err) => {
    //   if (err) console.error("Session destroy error:", err);
    //   req.flash('success', 'Password updated successfully. Please log in again.');
    //   res.redirect("/auth/login");
    // });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: err.message });
  }
});



router.get('/faqs', async function(req, res, next) {
   try{
  const [faqs] = await db.query("SELECT * FROM faqs ORDER BY id DESC");
  res.render('admin/faq/index',  {faqs})
  }catch(err){
    console.log(err.message)
  }
});

router.get("/faqs/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT * FROM faqs WHERE id = ?", [id]);
    if (rows.length === 0) {
      req.flash("error", "Faq not found.");
      return res.redirect("/admin/faqs");
    }

    await db.query("DELETE FROM faqs WHERE id = ?", [id]);
    req.flash("success", "Faqs deleted successfully!");
    res.redirect("/admin/faqs");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while deleting the faq.");
    res.redirect("/admin/faqs");
  }
});

router.get('/faqs/create', function(req, res, next) {
  res.render('admin/faq/create');
});

// Add multiple FAQs
router.post('/faqs', async (req, res) => {
    try {
        let { question, answer, type } = req.body;

        // Ensure both values are arrays
        question = Array.isArray(question) ? question : [question];
        answer = Array.isArray(answer) ? answer : [answer];
        type = Array.isArray(type) ? type : [type];

        // Check that both arrays have matching lengths
        if (question.length !== answer.length) {
            req.flash('error','Questions and answers do not match.');
        }

        // Validate the number of FAQs
        if (question.length === 0 || question.length > 50) {
            req.flash('error','Invalid number of FAQs.');
        }

        // Prepare FAQ records
        const faqs = [];

        for (let i = 0; i < question.length; i++) {

            const q = typeof question[i] === 'string'
                ? question[i].trim()
                : '';

            const a = typeof answer[i] === 'string'
                ? answer[i].trim()
                : '';

            const t = typeof type[i] === 'string'
                ? type[i].trim()
                : '';

            if (!q || !a || !t) {
                req.flash('error',
                    `Question and answer ${i + 1} are required.`
                );
            }

            faqs.push([q, a, t]);
        }

        // Start database transaction
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // Insert all FAQs
            await connection.query(
                `INSERT INTO faqs (question, answer, type) VALUES ?`,
                [faqs]
            );

            // Commit transaction
            await connection.commit();

            return res.redirect('/admin/faqs');

        } catch (error) {

            // Roll back if something goes wrong
            await connection.rollback();

            throw error;

        } finally {
            connection.release();
        }

    } catch (error) {

        console.error('FAQ Error:', error);

        req.flash('error', 'Unable to save FAQs. Please try again.');
    }
});

router.get('/jobs', async (req, res) => {
  try{
  const [jobs] = await db.query("SELECT * FROM jobs  ORDER BY name ASC");
  res.render('admin/job/index',  {jobs})
  }catch(err){
    console.log(err.message)
  }
})

// POST: Add multiple job categories.
router.post('/jobs', async (req, res) => {
    try {
        // Get the JSON string submitted by the tag input.
        const submittedJobs = req.body.jobs;

        // Convert the JSON string into a JavaScript array.
        let jobs = JSON.parse(submittedJobs || '[]');

        // Make sure the submitted value is an array.
        if (!Array.isArray(jobs)) {
            req.flash('error','Invalid job categories.');
        }

        // Clean the category names and remove empty values.
        jobs = jobs
            .filter(job => typeof job === 'string')
            .map(job => job.trim())
            .filter(job => job.length > 0)
            .map(job => job.substring(0, 100));

        // Remove duplicates from the submitted array.
        jobs = [...new Set(jobs.map(job => job.toLowerCase()))]
            .map(name => {
                return submittedJobs
                    ? JSON.parse(submittedJobs).find(
                        job => typeof job === 'string' &&
                        job.trim().toLowerCase() === name
                    ).trim()
                    : name;
            });

        if (jobs.length === 0) {
            req.flash('error','Add at least one job category.');
        }

        // Create one placeholder for each category.
        const placeholders = jobs.map(() => '(?)').join(', ');

        // Insert all categories.
        // INSERT IGNORE skips names that already exist.
        await db.query(`
            INSERT IGNORE INTO jobs (name)
            VALUES ${placeholders}
        `, jobs);

        req.flash('success','Job Categories added');
        res.redirect('/admin/jobs');

    } catch (err) {
        console.error('Add job categories:', err.message);
        req.flash('error','Unable to save job categories.');
    }
});

// POST: Delete a job category.
router.get('/jobs/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete the selected category.
        const [result] = await db.query(
            'DELETE FROM jobs WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            req.flash('error','Job category not found.');
        }

        req.flash('success','Job category deleted successfully.');
        res.redirect('/admin/jobs');

    } catch (err) {
        console.error('Delete job category:', err.message);
        req.flash('error','Unable to delete job category.');
    }
});


router.get('/messenger', async (req, res) => {
  try{
    role = "Worker"
  const [messengers] = await db.query("SELECT * FROM users where role != ? ORDER BY id DESC", [role]);
  res.render('admin/messenger/index',  { messengers: messengers})
  }catch(err){
    console.log(err.message)
  }
})

router.get('/messenger/create', (req, res) => {
  try{
  res.render('admin/messenger/create')
  }catch(err){
    console.log(err.message)
  }
})

router.post("/messenger", async (req, res) => {
  try {
    
    const { name, email, phone, gender, dob } = req.body;

      // Basic validation
    if (!name || !email || !phone || !gender || !dob) {
      req.flash('error', "All fields are required");
      return res.redirect("back");
    }

    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0){
      req.flash('error', "Email already exists" );
      return res.redirect("back");
    }

    const date = new Date();
    const hashed = await bcrypt.hash("password", 10);
    const role = "Messenger"
    const status = 1

    await db.query("INSERT INTO users (fullname, email, phone, gender, role,date, password, status) VALUES (?, ?, ?, ?, ?, ?, ?,?)", [
      name,
      email,
      phone,
      gender,
      role || "Messenger",
      date,
      hashed,
      status

    ]);
  

    req.flash('success', "Worker registered successfully" );
    return res.redirect("back");
  } catch (err) {
    req.flash('error',  err.message );
    return res.redirect("back");
  }
});

router.get('/worker', async (req, res) => {
  try{
    role = "Messenger"
  const [workers] = await db.query("SELECT * FROM users where role != ? ORDER BY id DESC", [role]);
  res.render('admin/worker/index',  { workers: workers})
  }catch(err){
    console.log(err.message)
  }
})

router.get('/worker/create', (req, res) => {
  try{
  res.render('admin/worker/create')
  }catch(err){
    console.log(err.message)
  }
})

router.post("/worker", async (req, res) => {
  try {
    
    const { name, email, phone, gender, dob } = req.body;

      // Basic validation
    if (!name || !email || !phone || !gender || !dob) {
      req.flash('error', "All fields are required");
      return res.redirect("back");
    }

    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0){
      req.flash('error', "Email already exists" );
      return res.redirect("back");
    }

    const date = new Date();
    const hashed = await bcrypt.hash("password", 10);
    const role = "Worker"

    await db.query("INSERT INTO users (fullname, email, phone, gender, role,date, password) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      name,
      email,
      phone,
      gender,
      role || "Worker",
      date,
      hashed

    ]);
  

    req.flash('success', "Worker registered successfully" );
    return res.redirect("back");
  } catch (err) {
    req.flash('error',  err.message );
    return res.redirect("back");
  }
});

router.get('/bookings', async (req, res) => {
  try{
  // const [workers] = await db.query("SELECT * FROM bookings ORDER BY id DESC");
  const [bookings] = await db.query(
        `
       SELECT
        b.*,
        customer.fullname AS customer_name,
        customer.email AS customer_email,
        customer.phone AS customer_phone,
        artisan.fullname AS artisan_name,
        artisan.email AS artisan_email,
        artisan.phone AS artisan_phone
      FROM bookings b
      LEFT JOIN users customer ON b.client_id = customer.id
      LEFT JOIN users artisan ON b.artisan_id = artisan.id
      ORDER BY b.id DESC
        `
      );
  
  res.render('admin/bookings/index',  { bookings: bookings})
  }catch(err){
    console.log(err.message)
  }
})

// View booking details
router.get('/booking/show/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT
        b.*,
        customer.fullname AS customer_name,
        customer.email AS customer_email,
        customer.phone AS customer_phone,
        artisan.fullname AS artisan_name,
        artisan.email AS artisan_email,
        artisan.phone AS artisan_phone
      FROM bookings b
      LEFT JOIN users customer ON b.client_id = customer.id
      LEFT JOIN users artisan ON b.artisan_id = artisan.id
      WHERE b.id = ?
      LIMIT 1
    `, [id]);

    if (!rows.length) {
      return res.redirect('/admin/bookings');
    }

    res.render('admin/bookings/show', {
      booking: rows[0]
    });

  } catch (err) {
    console.error('Booking details error:', err.message);
    res.status(500).send('Unable to load booking details');
  }
});

// Display booking edit page
router.get('/booking/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [bookingRows] = await db.query(`
      SELECT
        b.*,
        customer.fullname AS customer_name,
        artisan.fullname AS artisan_name
      FROM bookings b
      LEFT JOIN users customer ON b.client_id = customer.id
      LEFT JOIN users artisan ON b.artisan_id = artisan.id
      WHERE b.id = ?
      LIMIT 1
    `, [id]);

    if (!bookingRows.length) {
      return res.redirect('/admin/bookings');
    }

    // Retrieve customers.
    const [customers] = await db.query(`
      SELECT id, fullname, email
      FROM users
      WHERE role = 'Messenger'
      ORDER BY fullname ASC
    `);

    // Retrieve artisans.
    const [artisans] = await db.query(`
      SELECT id, fullname, email
      FROM users
      WHERE role = 'Worker'
      ORDER BY fullname ASC
    `);

    res.render('admin/bookings/edit', {
      booking: bookingRows[0],
      customers,
      artisans,
      error: null
    });

  } catch (err) {
    console.error('Edit booking page error:', err.message);
    res.status(500).send('Unable to load booking edit page');
  }
});


// Update booking
router.post('/booking/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      service,
      description,
      client_id,
      artisan_id,
      preferred_date,
      status
    } = req.body;

    // Check whether the booking exists.
    const [existing] = await db.query(
      'SELECT id FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (!existing.length) {
      return res.redirect('/admin/bookings');
    }

    // Validate required fields.
    if (!service || !description || !client_id || !status) {
      return res.status(400).send('Please complete all required fields.');
    }

    const allowedStatuses = [
      'pending',
      'accepted',
      'completed',
      'rejected'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).send('Invalid booking status.');
    }

    // Update booking information.
    await db.query(`
      UPDATE bookings
      SET
        service = ?,
        description = ?,
        client_id = ?,
        artisan_id = ?,
        preferred_date = ?,
        status = ?
      WHERE id = ?
    `, [
      service.trim(),
      description.trim(),
      client_id,
      artisan_id || null,
      preferred_date || null,
      status,
      id
    ]);

    res.redirect(`/admin/booking/show/${id}`);

  } catch (err) {
    console.error('Update booking error:', err.message);
    res.status(500).send('Unable to update booking.');
  }
});


router.get("/booking/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT * FROM bookings WHERE id = ?", [id]);
    if (rows.length === 0) {
      req.flash("error", "Booking not found.");
      return res.redirect("/admin/bookings");
    }

    await db.query("DELETE FROM bookings WHERE id = ?", [id]);
    req.flash("success", "Booking deleted successfully!");
    res.redirect("/admin/bookings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while deleting the Booking.");
    res.redirect("/admin/bookings");
  }
});

router.get('/messenger/edit/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      req.flash("error", "Messenger not found");
      return res.redirect("/admin/messenger/edit");
    }

    const messenger = rows[0]; // ✅ Get the first row
    res.render("admin/messenger/edit", { messenger });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while fetching lesson details");
    res.redirect("/admin/messenger/edit/:id");
  }
});

router.get('/worker/show/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      req.flash("error", "Worker not found");
      return res.redirect("/admin/worker");
    }
    const artisanid = rows[0].id; // Get the artisan ID
    const [bookings] = await db.query("SELECT * FROM bookings WHERE artisan_id = ? ORDER BY id DESC", [artisanid]); 
    const [completedJobs] = await db.query("SELECT * FROM bookings WHERE artisan_id = ? AND status = ? ORDER BY id DESC", [artisanid, "completed"]); 

    const artisan = rows[0]; // ✅ Get the first row
    res.render("admin/worker/show", { artisan, bookings, completedJobs });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while fetching lesson details");
    res.redirect("/admin/worker/show/:id");
  }
});





router.post('/messenger/block/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      req.flash("error", "Messenger not found");
      return res.redirect("/admin/messenger/edit");
    }
    const role = "Blocked"; // Set the role to "Blocked"

    await db.query(
        `UPDATE users 
         SET role = ?
         WHERE id = ?`,
        [role, id]
      );
      req.flash('success', 'Messenger blocked successfully!');
      res.redirect('/admin/messenger');
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while fetching lesson details");
    res.redirect("/admin/messenger/edit/:id");
  }
});

router.post('/messenger/unblock/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      req.flash("error", "Messenger not found");
      return res.redirect("/admin/messenger/edit");
    }
    const role = "Messenger"; // Set the role to "Messenger"

    await db.query(
        `UPDATE users 
         SET role = ?
         WHERE id = ?`,
        [role, id]
      );
      req.flash('success', 'Messenger unblocked successfully!');
      res.redirect('/admin/messenger');
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while fetching lesson details");
    res.redirect("/admin/messenger/edit/:id");
  }
});




   

module.exports = router;
