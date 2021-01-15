var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var bodyParser = require('body-parser');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    secret: "!@$!@#ZOEDR45454(*&^(",
    resave: false,
    saveUninitialized: true
}));

// public/images 디렉토리를 root 디렉토리처럼 취급
app.use(express.static(__dirname + '/public/'));
app.use(express.static(__dirname + '/public/images/'));
app.use(express.static(__dirname + '/public/images/download/'));

// index.js의 router 활성화
var router = require('./routes/index');
app.use('/', router);

app.listen(4000, function() {
    console.log('server running at port 4001');
});

module.exports = app;