var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const cors = require('cors');
var logger = require('morgan');
var dotenv =  require('dotenv'); //npm install dotenv
dotenv.config(); //load .env file
const moment = require('moment');
// For flash Message
const session = require('express-session');
const flash = require('connect-flash');




var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var apiRouter = require('./routes/api');
var adminRouter = require('./routes/admin');

var app = express();

app.use(cors());


app.use(session({
  secret: 'password',
  resave: false,
  saveUninitialized: true,
   cookie: {
    maxAge: 60 * 60 * 1000, // 1 hour
  }
}));


app.use(flash());

// app.use(contextMiddleware);

// Pass flash messages to all views (EJS)
app.use((req, res, next) => { 
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.errors = req.flash('errors') || [];
  res.locals.old = req.flash('old')[0] || {};
  next();
});


app.use(express.json());

app.locals.moment = moment;
// app.use(express.json());
app.use(express.urlencoded({ extended: true })); //json parser

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
