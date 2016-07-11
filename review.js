var MongoClient = require('mongodb').MongoClient;
var readline = require('readline');
var async = require('async');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



MongoClient.connect('mongodb://localhost:27017/deutsch', function(err, db) {

  var coll = db.collection('words');

  function quest(item, next){
    rl.question(item.word + "\n", str => {
      if (!str) {
        coll.updateOne({_id: item._id}, {$set: {trash: 1}}, next);
      } else {
        next();
      }
    });
  }

  coll.find({trash: {$ne: 1}}).sort({cnt: -1}).toArray().then(items => {
    async.eachSeries(items, quest);
  });

});