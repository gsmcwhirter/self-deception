var STATES = 2;
var MESSAGES = 2;
var ACTIONS = 3;
var STATE_PROBS = {q0: 0.5, q1: 0.5};
var PAYOFF_SCHEMES = {
  1: {q0: {a0: [5, 10], a1: [0.0, 0.0], a2: [6, 6]}, q1: {a0: [0.0, 0.0], a1: [5, 10], a2: [6, 6]}}
, 2: {q0: {a0: [1, 10], a1: [0.0, 0.0], a2: [6, 6]}, q1: {a0: [0.0, 0.0], a1: [1, 10], a2: [6, 6]}}
, 3: {q0: {a0: [1, 10], a1: [0.0, 0.0], a2: [6, 5]}, q1: {a0: [0.0, 0.0], a1: [1, 10], a2: [6, 6]}}
}

var _ = require("underscore")
  ;

module.exports = {
  base_n_bit: base_n_bit
, strategyToMaps: strategyToMaps
, strategyToStratdata: strategyToStratdata
, generateMgivenQ: generateMgivenQ
, generateQgivenM: generateQgivenM
, misuseAgainstPop: misuseAgainstPop
, deceptionAgainstReceiver: deceptionAgainstReceiver
, percentDeception: percentDeception

, STATES: STATES
, MESSAGES: MESSAGES
, ACTIONS: ACTIONS
, STATE_PROBS: STATE_PROBS
, PAYOFF_SCHEMES: PAYOFF_SCHEMES
};

function base_n_bit(base, number, bit)
{
    return Math.floor(number / Math.pow(base, bit)) % base;
}

function strategyToMaps(strategy){
  var maps = {sender: {}, receiver: {}};

  var i;

  //sender
  for (i = 0; i < STATES; i++){
    maps.sender['q'+i] = 'm'+base_n_bit(MESSAGES, strategy, i);
  }

  //receiver
  for (i = 0; i < MESSAGES; i++){
    maps.receiver['m'+i] = 'a'+base_n_bit(ACTIONS, Math.floor(strategy / Math.pow(MESSAGES, STATES)), i);
  }

  return maps;
}

function strategyToStratdata(strategy){
  return [{strategy: strategy, proportion: 1.0}];
}

function generateMgivenQ(data){
  var mgivenq = {};

  var i, j;
  for (i = 0; i < MESSAGES; i++){
    mgivenq['m'+i] = {};
    for (j = 0; j < STATES; j++){
      mgivenq['m'+i]['q'+j] = 0.0;
    }
  }

  data.forEach(function (stratdata){
    var maps = strategyToMaps(stratdata.strategy);

    for (i = 0; i < STATES; i++){
      mgivenq[maps.sender['q'+i]]['q'+i] += stratdata.proportion;
    }
  });

  return mgivenq;
}

function generateQgivenM(mgivenq){
  var qgivenm = {};
  var prm = {};

  var i,j;
  for (i = 0; i < MESSAGES; i++){
    prm['m'+i] = 0.0;

    for (j = 0; j < STATES; j++){
      prm['m'+i] += STATE_PROBS['q'+j] * mgivenq['m'+i]['q'+j];
    }
  }

  for (i = 0; i < STATES; i++){
    qgivenm['q'+i] = {};
    for (j = 0; j < MESSAGES; j++){
      if (prm['m'+j] > 0.0){
        qgivenm['q'+i]['m'+j] = STATE_PROBS['q'+i] * mgivenq['m'+j]['q'+i] / prm['m'+j];
      }
      else {
        qgivenm['q'+i]['m'+j] = Number.NEGATIVE_INFINITY;
      }
    }
  }

  return qgivenm;
}

function J(message, state, str_qgivenm, pop_qgivenm){
  if (pop_qgivenm[state][message] > 0.0){
    if (str_qgivenm[state][message] == 0.0){
      return Number.NEGATIVE_INFINITY;
    }
    else {
      return Math.log(str_qgivenm[state][message] / pop_qgivenm[state][message]) / Math.LN2;
    }
  }
  else {
    return 0.0;
  }
}

function misuseAgainstPop(message, state, strategy, pop){
  var str_stratdata = strategyToStratdata(strategy)
    , str_mgivenq = generateMgivenQ(str_stratdata)
    , pop_mgivenq = generateMgivenQ(pop)
    , str_qgivenm = generateQgivenM(str_mgivenq)
    , pop_qgivenm = generateQgivenM(pop_mgivenq)
    , states = []
    ;

  var i;
  for (i = 0; i < STATES; i++){
    states.push('q'+i);
  }

  return str_mgivenq[message][state] > 0 && J(message, state, str_qgivenm, pop_qgivenm) > 0 && _.any(states, function (statep){
    return state != statep && J(message, statep, str_qgivenm, pop_qgivenm) < 0;
  });
}

function deceptionAgainstReceiver(message, state, sender, receiver, pop, payoffs){
  var misuse = misuseAgainstPop(message, state, sender, pop);

  if (misuse){
    var receiver_maps = strategyToMaps(receiver).receiver
      ;

    //misuse implies use
    var action = receiver_maps[message]
      , actual_payoffs = payoffs[state][action]
      , best_action = 'a'+state.substring(1);
      ;

    //sender benefit
    if (actual_payoffs[0] <= payoffs[state][best_action][0]){
      return 0.0;
    }

    //receiver detriment
    if (actual_payoffs[1] >= payoffs[state][best_action][1]){
      return 0.0;
    }

    return 1.0;
  }
  else {
    return 0;
  }
}

function percentDeception(pop, payoffs_num){
  if (pop.length == 1){
    return 0;
  }

  var payoffs = PAYOFF_SCHEMES[payoffs_num];

  var pct = 0.0;

  pop.forEach(function (sender){
    pop.forEach(function (receiver){
      var i,j;

      for (i = 0; i < STATES; i++){
        for (j = 0; j < MESSAGES; j++){
          pct += deceptionAgainstReceiver('m'+j, 'q'+i, sender.strategy, receiver.strategy, pop, payoffs)
                 * sender.proportion
                 * receiver.proportion
                 * STATE_PROBS['q'+i];
        }
      }
    });
  });

  return pct;
}