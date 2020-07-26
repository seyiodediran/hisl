const express = require('express')
const mongoose = require('mongoose')
// const Article = require('./models/article')
// const articleRouter = require('./routes/articles')
// const methodOverride = require('method-override')
const app = express()
var bodyParser = require ("body-parser");
var ObjectId = require('mongodb').ObjectId

var http = require("http").createServer(app);
var io = require("socket.io")(http);

var formidable = require("formidable");
var fs = require("fs");
var session = require("express-session");

app.use(session({
	key: "admin",
	secret: "any random string"
}))

var MongoClient = require("mongodb").MongoClient;
MongoClient.connect("mongodb://localhost:27017", {useNewUrlParser: true, useUnifiedTopology: true}, function (error,client){
	var blog = client.db("blog");
	console.log("DB connected");




// mongoose.connect('mongodb://localhost:27017', {
//   useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true
// })

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }))
// app.use(methodOverride('_method'))

// app.get('/', async (req, res) => {
//   const articles = await Article.find().sort({ createdAt: 'desc' })
//   res.render('articles/index', { articles: articles })
// })

// app.get('/index2', async (req, res) => {
//   const articles = await Article.find().sort({ createdAt: 'desc' })
//   res.render('articles/index2', { articles: articles })
// })

// app.use('/articles', articleRouter)
app.post("/do-delete", function(req, res) {
	// if(req.session.admin) {
		fs.unlink(req.body.image.replace("/", ""), function(error) {
			blog.collection("posts").remove({
				"_id":ObjectId(req.body._id)
			}, function(error, document) {
				res.send("Deleted")
			})
		})
	// }else{
		// res.redirect("/admin")
	// }
})

app.get("/", function(req, res){
	blog.collection("posts").find().sort({"_id": -1}).toArray(function (error, posts) {
		res.render("users/home", {posts:posts})
	})
	
})
app.use('/assets', express.static('assets'));

app.use(express.static(__dirname + "/"));

app.get("/do-logout", function (req,res) {
	req.session.destroy();
	res.redirect("/admin")
})

app.get('/admin/dashboard', function(req, res){
	if (req.session.admin) {
	res.render('admin/dashboard')
	}else{
		res.redirect("/admin")
	}
})



app.get ( '/admin/posts', function(req, res){
	if (req.session.admin) {

		blog.collection("posts").find().toArray(function (error, posts) {
			res.render('admin/posts', {"posts" : posts})
		})
	
	}else{
		res.redirect("/admin")
	}
	
})

app.get("/posts/edit/:id", function(req, res) {
	if (req.session.admin) {
			blog.collection("posts").findOne({
				"_id": ObjectId(req.params.id)
			}, function(error, post ) {
					res.render("admin/edit_post", {"post" : post})
			})
	}else{
		res.redirect("/admin")
	}
})


app.post("/do-edit-post", function(req, res) {
	blog.collection("posts").updateOne({
		"_id":ObjectId(req.body._id)
	}, {
		$set: {
			"title": req.body.title,
			"description": req.body.description,
			"content": req.body.content,
			"image": req.body.image
		}
	}, function (error,post) {
		res.send("Updated Successfully");
	})
})

app.post("/do-admin-login", function (req, res) {
	blog.collection("admins").findOne({"email": req.body.email, "password": req.body.password}, function (error, admin) {
		if(admin != "") {
			req.session.admin = admin;
		}
		res.send(admin);
	});
})

app.get("/admin", function (req, res) {
	res.render("admin/login")
})


app.post("/do-post", function (req,res){
	blog.collection("posts").insertOne(req.body, function (error, document){
		res.send({
			text: "posted successfully",
			_id: document.insertedId
		});
	})
})
// app.get('/',function(req,res){
//  res.sendFile('index.ejs', {root : __dirname});
// });


app.get("/posts/:id", function (req, res) {
	blog.collection("posts").findOne({"_id":ObjectId(req.params.id)}, function(error, post){
		res.render("users/post", {post:post});
	})
})


app.post("/do-reply", function (req, res) {
	var reply_id = ObjectId();


	blog.collection("posts").updateMany({"_id":ObjectId(req.body.post_id),
		"comments._id":ObjectId(req.body.comment_id)

	},{
		$push: {
			"comments.$.replies": {
				_id: reply_id,
				name: req.body.name,
				reply: req.body.reply
			}
		}
	}, function (error, document) {
		res.send({
			text: "Replied",
			_id: reply_id


		})
	})

})


app.post("/do-comment", function (req, res) {
	var comment_id = ObjectId();

	blog.collection("posts").updateOne({"_id":ObjectId(req.body.post_id)}, {
		$push: {
			"comments": {_id: comment_id, username:req.body.username, comment:req.body.comment, email: req.body.email}
		}
	},
		function ( error, post){
			res.send({
				text:"comment successfull",
				_id: post.insertedId
		});
	})
})




app.post("/do-upload-image", function (req, res) {
	var formData = new formidable.IncomingForm();
	formData.parse(req, function (error, fields, files) {
		var oldPath = files.file.path;
		var newPath = "views/images/" + files.file.name;

		fs.rename (oldPath, newPath, function(err) {
			res.send("/" + newPath);
		})
		
	})
}) 

app.post("/do-update-image", function(req, res) {
	var formData = new formidable.IncomingForm();
	formData.parse(req, function (error, fields, files) {

		fs.unlink(fields.image.replace("/", ""),function(error) {
			var oldPath = files.file.path;
		var newPath = "views/images/" + files.file.name;

		fs.rename (oldPath, newPath, function(err) {
			res.send("/" + newPath);
		})
		})
		
		
	})
})


io.on("connection", function (socket) {
	console.log("user connected");


	socket.on("new_post", function (formData) {
		console.log(formData)
		socket.broadcast.emit("new_post", formData)
	})

	socket.on("new_comment", function(comment) {
				io.emit("new_comment", comment);
	})

	socket.on("delete_post", function (replyId) {
		socket.broadcast.emit("delete_post", replyId);
	})
})

http.listen(5000)







})
