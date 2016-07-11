'use strict';

var FeedParser = require('feedparser');
var fs = require('fs');
var Promise = require('bluebird');
var feeds = [
  'http://slowgerman.com/feed/podcast/',
  'http://rss.dw.com/xml/DKpodcast_lgn_de',
  'http://www.faz.net/rss/aktuell/'
];
var rp = require('request-promise');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var mongoPromise = new Promise((resolve, reject) => {
  MongoClient.connect('mongodb://localhost:27017/deutsch', function(err, db) {
    if (err) return reject(err);
    resolve(db);
  });
});
let allItems = [];

function getFeedPromise(feed) {
  return new Promise((resolve, reject) => {
    const feedparser = new FeedParser();
    const req = request(feed);
    req.on('error', error => {
      reject(error);
    });

    req.on('response', (res) => {
      if (res.statusCode != 200) {
        reject('Bad status code')
      }
    });

    feedparser.on('data', function(item) {
      console.log(feed, item.title);
      allItems.push(item);
    });

    feedparser.on('error', function(error) {
      reject(error);
    });

    feedparser.on('end', () => {
      resolve();
    });

    req.pipe(feedparser);
  });
}


mongoPromise.then(db => {
  allItems = [];
  return Promise.all(feeds.map(getFeedPromise)).then(() => {
    return Promise.map(allItems, item => {
      const processed = db.collection('processed');
      return processed.count({uid: item.guid}).then(exist => {
        if (exist) return;
        const coll = db.collection('words');
        item.description = item.description.replace(/<\/?[^>]+(>|$)/g, "");
        const words = item.description.split(' ').map(word => {
          return word.replace(/\.,\!\?;/g, '');
        }).filter(word => {
          if (!word) return false;
          if (word === '-') return false;
          if (word.match(/\/\\\=\>\<\(\\"\'\)#[0-9]+]/)) return false;
          return true;
        });
        console.log('words', item.title, words.length);
        return Promise.map(words, word => {
          return coll.updateOne({word}, {$set: {word}, $inc: {cnt: 1}}, {upsert: true, safe: false});
        }).then(() => {
          console.log('Inserting..', item.guid);
          return processed.insertOne({uid: item.guid});
        })
      });

    })
  }).then(() => {
    console.log('Done');
  });
}).catch(err => {
  console.log(err);
});