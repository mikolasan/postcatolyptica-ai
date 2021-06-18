//vim :set ts=2 sw=2 sts=2 et :

'use strict'

const Natural = require('natural');
const Pos = require('pos');
const cats = require('./cats-db.json');
const synonyms = require('./synonyms.json');


module.exports = class CatSearchEngine {
  constructor(callback) {
    this.tagger = new Pos.Tagger();
    this.sentenceTokenizer  = new Natural.SentenceTokenizer();
    this.wordTokenizer = new Natural.WordTokenizer();
    const TermFrequency = Natural.TfIdf; // Term Frequency–Inverse Document Frequency
    this.termFrequency = new TermFrequency();

    this.prepareBase(callback);
  }

  extractModelWords(taggedWords) {
    var seen = new Set();
    return taggedWords.filter(token => {
      var word = token[0];
      var pos = token[1];
      if (seen.has(word))
        return false;
      if (!pos.includes("NN") && !pos.includes("VB"))
        return false;
      seen.add(word);
      return true;
    })
    .map(token => {
      return {word: token[0], pos: token[1]};
    });
  }

  preProcessText() {
    var paragraphId = 0;
    for (const breed in cats) {
      const details = cats[breed]
      let paragraph = details.size + ". " + details.coat + ". " + details.color + ". " + details.description + details.did_you_know;
      this.termFrequency.addDocument(paragraph);
      cats[breed].paragraphId = paragraphId;
      cats[breed].paragraph = paragraph;
      let sentencesRaw = this.sentenceTokenizer.tokenize(paragraph);
      cats[breed].model = {};
      cats[breed].sentences = sentencesRaw.map(sentence => {
        var words = this.wordTokenizer.tokenize(sentence);
        var taggedSentence = this.tagger.tag(words);
        var modelWords = this.extractModelWords(taggedSentence);
        modelWords.forEach(token => {
          cats[breed].model[token.word] = token;
        });
        return {
          text: sentence,
          words: words,
          modelWords: modelWords
        };
      });
      ++paragraphId;
    }
  }

  weightTokens() {
    for (let breed in cats) {
      let details = cats[breed];
      for (let word in details.model) {
        details.model[word].weight = this.termFrequency.tfidf(word, details.paragraphId);
        details.model[word].synonyms = synonyms[word] || [];
      }
    }
  }

  prepareBase(callback) {
    this.preProcessText();
    this.weightTokens();
    callback();
  }

  scoreWords(array, word) {
    var score = 0;
    for (let i = 0; i < array.length; ++i) {
      score = 1/(Natural.LevenshteinDistance(array[i], word)+0.000001);
    }
    return score;
    //return Natural.JaroWinklerDistance(a, b) > 0.5? 1 : 0;
  }

  highlightWord(sentence, word) {
    var index = sentence.indexOf(word);
    if (index !== -1) {
      const neighborhoodSymbols = 30;
      var startPos = sentence.indexOf(" ", index - neighborhoodSymbols);
      var endPos = sentence.indexOf(" ", index + word.length + neighborhoodSymbols);
      var prefix = "", suffix = "";
      if (startPos > index || startPos < 0) {
        startPos = 0;
      } else {
        prefix = "...";
      }
      if (endPos < index || endPos > sentence.length) {
        endPos = undefined;
      } else {
        suffix = "...";
      }
      var shortString = prefix + sentence.slice(startPos, endPos) + suffix;
      var shortIndex = shortString.indexOf(word);
      return {
        index: shortIndex,
        excerpt: shortString,
        highlightWord: word,
        excerpt1: shortString.slice(0, shortIndex),
        excerpt2: shortString.slice(shortIndex + word.length)
      };
    } else {
      return null;
    }
  }

  search(query) {
    var queryWords = this.wordTokenizer.tokenize(query);
    var result = [];
    for (let breed in cats) {
      let totalScore = 0;
      let data = cats[breed];
      let tokens = data.model;
      let spotlight = {score: 0, word: ""};
      for (let t in tokens) {
        let token = tokens[t];
        let wordScore = 0;
        wordScore += this.scoreWords(queryWords, token.word);
        for (let s = 0; s < token.synonyms.length; ++s) {
          let word = token.synonyms[s];
          wordScore += this.scoreWords(queryWords, word);
        }
        token.wordScore = wordScore;
        totalScore += wordScore;
        if (wordScore > 0 && wordScore > spotlight.score) {
          spotlight.score = wordScore;
          spotlight.word = token.word;
        }
      }
      data.totalScore = totalScore;
      if (totalScore > 0) {
        data.title =
          this.highlightWord(data.did_you_know, spotlight.word) ||
          this.highlightWord(data.description, spotlight.word) ||
          this.highlightWord(data.size, spotlight.word) ||
          this.highlightWord(data.coat, spotlight.word) ||
          this.highlightWord(data.color, spotlight.word) ||
          this.highlightWord(data.did_you_know, tokens[0].word) ||
          this.highlightWord(data.description, tokens[0].word) ||
          this.highlightWord(data.size, tokens[0].word) ||
          this.highlightWord(data.coat, tokens[0].word) ||
          this.highlightWord(data.color, tokens[0].word);
        console.log('search', totalScore, spotlight, data.title, data);
        result.push(data);
      }
    }
    return result.sort((a, b) => a.totalScore < b.totalScore).splice(0, 5);
  }
};

