const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const path = require('path')

const mongoose = require('mongoose')
const UserModel = require('./models/User')
const ExerciseModel = require('./models/Exercise')
const connectDB = require('./config/dbConn')

//cors fully open to allow FCC test our api
app.use(cors())

app.use(express.json())

//bodyparser, included in express, you need it to get data from http forms
//adding the {extended: true} removes the warning in console, remember it.
app.use(express.urlencoded({extended: true}))

//comes from dbConn.js, it makes the connection to mongo using .env data
connectDB()

//serving static files
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});



// Converts a Date object to YYYY-MM-DD date string - Used to store dates in mongo
function toYYYYMMDD (dateToConvert) {
    return dateToConvert.toISOString().slice(0,10)
}


//Changes exercises dates from YYYY-MM-DD (stored like that in DB) to String format 
//required to comply with the project requirement
function formatDates (exercisesList) {
    return exercisesList.map((exercise) => {
      const formDate = new Date(exercise.date).toDateString()
      exercise.date = formDate
      return exercise
    })
}



//routes that handles user creation
app.post('/api/users', async (req, res) => {
  //res.json(req.body)
  const { username } = req.body

  if (!username){
     return res.json({error: 'You must provide an username'})
  }

  const newUser = new UserModel({ username })
  await newUser.save()

  res.json({username: newUser.username, _id: newUser._id})
})



//route that returns all users created and the id's
app.get('/api/users', async (req, res) => {
    const users = await UserModel.find().select('-__v').exec()
    res.json([users])
})



//this endpoint allow us to create exercises
app.post('/api/users/:id/exercises', async (req, res) => {
  // const { id } = req.params
  // res.json(id)

  const { id } = req.params
  let { description, duration, date } = req.body

  // return res.json(id)

  if ( !description || !duration || !id ){
      return res.json({ error: 'You must provide a description, a duration and a valid id, date is optional.' })
  }

  //getting the username using the given id, this is required to create a new exercise.
  const user = await UserModel.findOne({ _id: id }).lean().exec()

  const { username } = user
  // return res.json([user, username])
  if (!username){
    return res.json({ error: 'Invalid id'})
  }

  if ( !date ) {
    // date = new Date().toDateString()
    
    date = toYYYYMMDD(new Date())
    // return res.json({ msg: date })
  }

  // res.json({username, description, duration, date, _id: id})
  const newExercise = new ExerciseModel( { username, description, duration, date, id } )
  newExercise.save()

  // res.json(newExercise)
  const formDate = new Date(newExercise.date).toDateString()
  // res.json({_id: newExercise._id, username: newExercise.username, date: newExercise.date, duration: newExercise.duration, description: newExercise.description})
  res.json({_id: newExercise._id, username: newExercise.username, date: formDate, duration: newExercise.duration, description: newExercise.description})
})



//routes be like ->
//domain/api/users/000001/logs                                  gets every exercise of a given id
//domain/api/users/000001/logs?limit=50                         gets 50 exercises of a given id
//domain/api/users/000001/logs?from=1990-01-01&to=2000-12-31    get all exercises in a given range
//domain/api/users/000001/logs?from=2000-01-01&limit=10
//domain/api/users/000001/logs?from=2000-01-01&to=2020-01-01&limit=5
app.get('/api/users/:id/logs', async (req, res) => {
  //catching query parameters - from to and limit are optional - id is mandatory
  let { from, to, limit } = req.query
  const { id } = req.params

  //we set up from to min date if it was blank
  if (!from){
    const minDate = '1000-01-01'
    from = minDate
  }

  //setting to variable to max date if it was blank
  if (!to){
    const maxDate = '2999-12-31'
    to = maxDate
  }

  //if id is blank we send an error
  if (!id){
    return res.json({error: 'Please provide a valid user id'})
  }

  //check if an username with that id exists and save username for later usage
  const username = await UserModel.findOne({ _id: id }).select('-_id username').lean().exec()

  if(!username){
    return res.json({error: 'User doesnt exists'})
  }

  //getting exercises
  const exercises = await ExerciseModel.find({ id, date: { $gte: from, $lte: to } })
                                      .select('-_id description duration date')
                                      .limit(limit)
                                      .lean()
                                      .exec()

  //add validation to check if it has atleast 1 exercise to show or errror
  if(!Array.isArray(exercises) || !exercises.length){
    return res.json({error: 'User has no exercises yet'})
  }

  res.json({_id: id, username: username.username, count: exercises.length, log: formatDates(exercises)})
})



//Routes to catch anything left - most likely 404 pages because wrong address 
app.all('*', async (req, res) => {
// app.all('*', (req, res) => {
  res.status(404)

  //checking if device / headers accepts html
    res.sendFile(path.join(__dirname, 'views', '404.html'))
  if (req.accepts('html')){
  }

  //maybe it can accept json
  else if (req.accepts('json')){
    res.json({ error: '404 Not Found' })
  }

  //sending plain text, in case it's an old device or something
  else {
    res.type('txt').send('404 Not Found')
  }
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port ' + listener.address().port)
})
