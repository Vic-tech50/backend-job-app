var express = require('express');
require("dotenv").config();
var router = express.Router();
const db = require("../db"); //import database connection from db.js
const moment = require('moment'); // npm install moment for diffForHuman date format()


router.get('/dashboard', function(req, res, next) {
  res.render('dashboard');
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

router.get('/worker', async (req, res) => {
  try{
    role = "Messenger"
  const [workers] = await db.query("SELECT * FROM users where role != ? ORDER BY id DESC", [role]);
  res.render('admin/worker/index',  { workers: workers})
  }catch(err){
    console.log(err.message)
  }
})

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
