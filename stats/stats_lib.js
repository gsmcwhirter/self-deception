var _ = require("underscore")
  ;

module.exports = Analyzer;

function Analyzer(num_states, num_messages, state_probs, inspect_cost, payoffs, best_responses, codes){
  this.states = num_states;
  this.messages = num_messages;
  this.state_probs = state_probs;
  this.inspect_cost = inspect_cost;
  this.payoffs = payoffs;
  this.best_responses = best_responses;
  this.codes = {state: codes.state+'' || '', message: codes.message+'' || ''};
}

/*
function leadingLetters(sender_data){
  var keys = _.filter(Object.keys(sender_data), function (item){return sender_data.hasOwnProperty(item);});
  
  if (keys.length === 0){
    return null;
  }

  var keys2 = _.filter(Object.keys(sender_data[keys[0]]), function (item){return sender_data[keys[0]].hasOwnProperty(item)});

  return {state: sender_data[keys[0]].substring(0,1), message: sender_data[keys[0]][keys2[0]].substring(0,1)};
}
*/

Analyzer.prototype.generateMgivenQ = function (sender_data){
  var mgivenq = {};

  var i, j;
  for (i = 0; i < this.num_messages; i++){
    mgivenq[this.codes.message+i] = {};
    for (j = 0; j < this.num_states; j++){
      if (sender_data[this.codes.state+j] && sender_data[this.codes.state+j][this.codes.message+i]){
        mgivenq[this.codes.message+i][this.codes.state+j] = sender_data[this.codes.state+j][this.codes.message+i]
      }
      else {
        mgivenq[this.codes.message+i][this.codes.state+j] = 0.0;
      }
    }
  }

  return mgivenq;
};

Analyzer.prototype.generateQgivenM = function (mgivenq){
  var qgivenm = {};
  var prm = {};

  var i,j;
  for (i = 0; i < this.num_messages; i++){
    prm[this.codes.message+i] = 0.0;

    for (j = 0; j < this.num_states; j++){
      prm[this.codes.message+i] += this.state_probs[this.codes.state+j] * mgivenq[this.codes.message+i][this.codes.state+j];
    }
  }

  for (i = 0; i < this.num_states; i++){
    qgivenm[this.codes.state+i] = {};
    for (j = 0; j < this.num_messages; j++){
      if (prm[this.codes.message+j] > 0.0){
        qgivenm[this.codes.state+i][this.codes.message+j] = this.state_probs[this.codes.state+i] * mgivenq[this.codes.message+j][this.codes.state+i] / prm[this.codes.message+j];
      }
      else {
        qgivenm[this.codes.state+i][this.codes.message+j] = Number.NEGATIVE_INFINITY;
      }
    }
  }

  return qgivenm;
};

//here
Analyzer.prototype.J = function (message, state, pop_qgivenm){
  if (pop_qgivenm[state][message] > 0.0){
    /*
    if (str_qgivenm[state][message] == 0.0){
      return Number.NEGATIVE_INFINITY;
    }
    else {
      return Math.log(str_qgivenm[state][message] / pop_qgivenm[state][message]) / Math.LN2;
    }
    */
    return Math.log(1.0 / pop_qgivenm[state][message]) / Math.LN2;
  }
  else {
    return 0.0;
  }
};

Analyzer.prototype.misuse = function (sender_data, message, state){
  var mgivenq = this.generateMgivenQ(sender_data)
    , qgivenm = this.generateQgivenM(mgivenq)
    , states = []
    ;

  var i;
  for (i = 0; i < this.num_states; i++){
    states.push(this.codes.state+i);
  }

  var self = this;

  return mgivenq[message][state] > 0 && this.J(message, state, qgivenm) > 0 && _.any(states, function (statep){
    return state != statep && self.J(message, statep, qgivenm) < 0;
  });
};

Analyzer.prototype.deceptionAgainstReceiver = function (message, state, sender_maps, receiver_maps){
  var misuse = this.misuseAgainstPop(message, state, sender_maps);

  if (misuse){
    //misuse implies use
    var possible_actions = Object.keys(receiver_maps[message]);

    var pct = 0.0;

    possible_actions.forEach(function (action){
      var actual_payoffs = this.payoffs[state][action]
        , best_action = this.best_responses[state]
        ;

      //sender benefit
      if (actual_payoffs[0] <= this.payoffs[state][best_action][0]){
        return;
      }

      //receiver detriment
      if (actual_payoffs[1] >= this.payoffs[state][best_action][1]){
        return;
      }

      pct += receiver_maps[message][action];
    });

    return pct;
  }
  else {
    return 0;
  }
};

Analyzer.prototype.percentDeception = function (sender_maps, receiver_maps){
  var pct = 0.0;
  var i,j;

  for (i = 0; i < this.num_states; i++){
    for (j = 0; j < this.num_messages; j++){
      pct += this.deceptionAgainstReceiver(this.codes.message+j, this.codes.state+i, sender_maps, receiver_maps)
             * sender_maps[this.codes.state+i][this.codes.state+j]
             * this.state_probs[this.codes.state+i];
    }
  }

  return pct;
};