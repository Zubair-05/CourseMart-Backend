const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors())
const SECRET = process.env.JSON_SECRET_KEY;  // This should be in an environment variable in a real application
const PORT = process.env.PORT || 3000;

const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Define mongoose schemas
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        // unique: true
    },
    email : {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    ImageLink: String,
    purchasedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    ImageLink: String,
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const courseSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    imageLink: String,
    isPublished: Boolean,
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

// Define mongoose models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Course = mongoose.model('Course', courseSchema);


mongoose.connect(`${process.env.MONGOOSE_URI}`, { useNewUrlParser: true, useUnifiedTopology: true, dbName: "courseApp" });

const db = mongoose.connection;

db.on('error', (error) => {
    console.error('Connection error:', error);
});

db.once('open', () => {
    console.log('Connected to MongoDB database');
});

db.on('disconnected', () => {
    console.log('Disconnected from MongoDB database');
});

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, SECRET, (err, decoded) => {
            if (err) {
                res.status(401).json({status:401, message: 'Invalid token' });
            } else {
                req.email = decoded.email;
                req.role = decoded.role;
                next();
            }
        });
    } else {
        res.status(401).json({ message: 'No token' });
    }
};

app.post('/admin/signup', async (req, res) => {
    const { username, email, password } = req.body;
    const admin = new Admin({ username, email, password });
    try {
        const newAdmin = await Admin.findOne({ email });
        if (newAdmin) {
            res.status(400).json({ message: 'Admin already exists' });
        } else {
            await admin.save();
            const token = jwt.sign({ email, role : 'Admin' }, SECRET, {expiresIn: '24h'});
            res.status(201).json({ message: 'Admin created successfully', token: token });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


app.post('/admin/login', async (req, res) => {
    const { email, password } = req.headers;

    try {
        const admin = await Admin.findOne({ email });
        if (admin && admin.password === password) {
            const token = jwt.sign({ email, role:'admin' }, SECRET);
            res.status(200).json({ message: 'Logged in successfully', token });
        } else {
            res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/admin/profile', auth, async (req, res) => {
    const { email } = req;
    try{
        const admin = await Admin.findOne({ email });
        // console.log(admin);
        if(!admin) res.status(400).json({ message: 'Admin not found' });
        else res.status(200).json({ admin });
    } catch(err){
        res.status(500).json({ message: err.message });
    }
})

app.put('/admin/profile', auth, async (req, res) => {
    const {email} = req;
    const { username } = req.body;
    try{
        const admin = await Admin.findOne({ email });
        admin.username = username;
        await admin.save();
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch(err){
        res.status(500).json({ message: err.message });
    }
})


app.post('/admin/courses', auth, async (req, res) => {
    const course = req.body;
    const { email } = req;
    course.createdAt = Date.now();
    console.log(email);
    const admin = await Admin.findOne({ email });
    course.creator = admin._id;
    try {
        const newCourse = new Course(course);
        const createdCourse = await newCourse.save();
        admin.courses.push(createdCourse._id);
        console.log(admin.courses);
        await admin.save();
        res.status(201).json(newCourse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



app.get('/admin/courses', auth, async (req, res) => {
    const { email } = req;
    const admin = await Admin.findOne({ email });
    try {
        const courses = await Course.find({ creator: admin._id });
        res.status(200).json({ courses });
    } catch (err) {
        console.log({ message: err.message });
    }
})

app.put('/admin/courses/:id', auth, async (req, res) => {
    const { id } = req.params;
    const course = req.body;
    try {
        await Course.findByIdAndUpdate(id, course);
        res.status(200).json({ message: 'Course updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

app.delete('/admin/courses/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { email } = req;
    try {
        const course = await Course.findByIdAndDelete(id);
        const admin = await Admin.findOne({ email });
        admin.courses = admin.courses.filter(courseId => courseId.toString() !== course._id.toString());
        await admin.save();
        res.status(200).json({ message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

app.post('/users/signup', async (req, res) => {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    console.log('hi');
    try {
        const newUser = await User.findOne({ email });
        if (newUser) {
            console.log('Already exists');
            res.status(400).json({ message: 'User already exists' });
        } else {
            await user.save();
            const token = jwt.sign({ email }, SECRET);
            console.log(token);
            res.status(201).json({ message: 'user created successfully', token: token });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

app.post('/users/login', async (req, res) => {
    const { email, password } = req.headers;
    try {
        const user = await User.findOne({ email });
        if (user && user.password === password) {
            const token =  jwt.sign({ email }, SECRET);
            res.status(200).json({ message: 'Logged in successfully', token });
        } else {
            res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.get('/users/courses', auth, async (req, res) => {
    try {
        const courses = await Course.find();
        res.status(200).json({ courses });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post('/users/courses/:id', auth, async (req, res) => {
    const course = await Course.findById(req.params.id);
    const { id } = req.params;
    const { email } = req;
    try {
        const user = await User.findOne({ email });
        if (user) {
            user.purchasedCourses.push(course._id);
            await user.save();
            res.status(200).json({ message: 'Course purchased successfully' });
        } else {
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.get('/users/purchasedCourses', auth, async (req, res) => {
    const { email } = req;
    try {
        const user = await User.findOne({ email }).populate('purchasedCourses');
        if (user) {
            // const courses = user.purchasedCourses;
            res.status(200).json({ purchasedCourses: user.purchasedCourses || [] })
        } else {
            res.status(400).json({ message: 'User not found' });
        }

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post('/users/cart/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { email } = req;
    try {
        const course = await Course.findById(id);
        const user = await User.findOne({ email });
        if(user && course){
            if(user.cart.includes(course._id)){
                res.status(400).json({ message: 'Course already added to cart' });
            } else {
                user.cart.push(course._id);
                await user.save();
                res.status(200).json({ message: 'Course added to cart successfully' });
            }
            // res.status(200).json({ message: 'Course added to cart successfully' });
        } else{
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/users/cart/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { email } = req;
    try{
        const user =await User.findOne({ email });
        if(user){
            user.cart = user.cart.filter(courseId => courseId.toString() !== id.toString());
            await user.save();
            res.status(200).json({ message: 'Course removed from cart successfully' });
        } else{
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.get('/users/cart', auth, async (req, res) => {
    const { email } = req;
    try {
        const user = await User.findOne({ email }).populate('cart');
        if (user) {
            // console.log(user.cart);
            res.status(200).json({ cart: user.cart || [] })
        } else {
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.get('/users/profile', auth, async (req, res) => {
    const { email } = req;
    try{
        const user = await User.findOne({ email });
        const data = {
            username: user.username,
            email: user.email
        }
        res.status(200).json({ user : data });
    } catch (err){
        res.status(500).json({ message: err.message });
    }
})

app.put('/users/profile', auth, async (req, res) => {
    const {email} = req;
    const { username } = req.body;
    try{
        const user = await User.findOne({ email });
        user.username = username;
        await user.save();
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch(err){
        res.status(500).json({ message: err.message });
    }
})

app.listen(PORT, () => {
    console.log('Server started on port 3000');
});