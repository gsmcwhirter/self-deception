var _ = require("underscore")
  ;

module.exports = {
  InformationAnalyzer: InformationAnalyzer
, SelfDeceptionAnalyzer: SelfDeceptionAnalyzer
, ExtDeceptionAnalyzer: ExtDeceptionAnalyzer
};

function InformationAnalyzer(num_states, num_messages, state_probs, codes){
  this.states = num_states;
  this.messages = num_messages;
  this.state_probs = state_probs;
  this.codes = {state: codes.state+'' || '', message: codes.message+'' || ''};
}

InformationAnalyzer.prototype.generateMgivenQ = function (sender_data){
  var mgivenq = {};

  var i, j;
  for (i = 0; i < this.messages; i++){
    mgivenq[this.codes.message+i] = {};
    for (j = 0; j < this.states; j++){
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

InformationAnalyzer.prototype.generateQgivenM = function (mgivenq){
  var qgivenm = {};
  var prm = {};

  var i,j;
  for (i = 0; i < this.messages; i++){
    prm[this.codes.message+i] = 0.0;

    for (j = 0; j < this.states; j++){
      prm[this.codes.message+i] += this.state_probs[this.codes.state+j] * mgivenq[this.codes.message+i][this.codes.state+j];
    }
  }

  for (i = 0; i < this.states; i++){
    qgivenm[this.codes.state+i] = {};
    for (j = 0; j < this.messages; j++){
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

InformationAnalyzer.prototype.J = function (message, state, pop_qgivenm, str_qgivenm){
  if (pop_qgivenm[state][message] > 0.0){
    
    if (str_qgivenm[state][message] == 0.0){
      return Number.NEGATIVE_INFINITY;
    }
    else {
      return Math.log(str_qgivenm[state][message] / pop_qgivenm[state][message]) / Math.LN2;
    }
    
    //return Math.log(1.0 / pop_qgivenm[state][message]) / Math.LN2;
  }
  else {
    return 0.0;
  }
};

InformationAnalyzer.prototype.generatePureSenderStrategies = function (sender_data){
  var strategies = [];
  var tmp;
  var state;

  for (var i  = 0; i < this.states; i++){
    state = this.codes.state+i;
    tmp = [];

    if (strategies.length === 0){
      Object.keys(sender_data[state]).forEach(function (msg){
        var strat = {};
        strat[state] = {};
        strat[state][msg] = 1.0;
        tmp.push(strat);
      });
    }
    else {
      strategies.forEach(function (base_strat){
        Object.keys(sender_data[state]).forEach(function (msg){
          var clone = _.clone(base_strat);
          clone[state] = {};
          clone[state][msg] = 1.0;
          tmp.push(clone);
        });
      });
    }

    strategies = tmp.slice(0);
  }

  return strategies;
};

InformationAnalyzer.prototype.misuse = function (sender_data, pop_data, message, state){
  var pop_mgivenq = this.generateMgivenQ(pop_data)
    , pop_qgivenm = this.generateQgivenM(pop_mgivenq)
    , sdr_mgivenq = this.generateMgivenQ(sender_data)
    , sdr_qgivenm = this.generateQgivenM(sdr_mgivenq)
    , states = []
    ;

  //console.log(mgivenq);
  //console.log(qgivenm);

  var i;
  for (i = 0; i < this.states; i++){
    states.push(this.codes.state+i);
  }

  var self = this;

  // console.log(message);
  // console.log(state);
  // console.log(mgivenq[message][state]);
  // console.log(this.J(message, state, qgivenm));

  return sdr_mgivenq[message][state] > 0 && this.J(message, state, pop_qgivenm, sdr_qgivenm) > 0 && _.any(states, function (statep){
    //console.log(self.J(message, statep, qgivenm));
    //return state != statep && self.J(message, statep, qgivenm) < 0;
    return state != statep && self.J(message, statep, pop_qgivenm, sdr_qgivenm) < 0;
  });
};

function SelfDeceptionAnalyzer(num_states, num_messages, num_actions, num_situations, inspect_prob, decision_contrib, base_uc_payoffs, receiver_maps, codes){
  this.codes = codes || {};
  if (!this.codes.state) this.codes.state = 'q';
  if (!this.codes.message) this.codes.message = 'm';
  if (!this.codes.action) this.codes.action = 'a';
  if (!this.codes.situation) this.codes.situation = 's';

  this.states = [];
  this.messages = [];
  this.actions = [];
  this.situations = [];
  this.inspect_prob = inspect_prob;
  this.decision_contrib = decision_contrib;

  this.uc_payoffs = base_uc_payoffs;

  var i;
  
  for (i = 0; i < num_states; i++){
    this.states.push(this.codes.state+i);
  }

  for (i = 0; i < num_messages; i++){
    this.messages.push(this.codes.message+i);
  }

  for (i = 0; i < num_actions; i++){
    this.actions.push(this.codes.action+i);
  }

  for (i = 0; i < num_situations; i++){
    this.situations.push(this.codes.situation+i);
  }
  
  this.uc_payoffs_byaction = this.calculateByActionUCPayoffs(receiver_maps);
  this.best_messages = this.calculateBestMessages(receiver_maps);
}

SelfDeceptionAnalyzer.prototype.calculateByActionUCPayoffs = function (receiver_maps){
  var payoffs = {};
  var self = this;
  self.situations.forEach(function (sit){
    payoffs[sit] = {};

    self.states.forEach(function (state){
      payoffs[sit][state] = {};

      self.messages.forEach(function (msg){
        payoffs[sit][state][msg] = {};

        self.actions.forEach(function (act){
          var poff = [0.0, 0.0];
          //calculate the expected payoff from sending that message
          var act_prob = 0.0;
          var random_comp;
          if (receiver_maps[sit][msg][act]){
            act_prob = receiver_maps[sit][msg][act];
            if (act != 'a3'){
              // poff[0] += act_prob * self.uc_payoffs[sit][state][act][0];
              // poff[1] += act_prob * self.uc_payoffs[sit][state][act][1];
              poff[0] += self.uc_payoffs[sit][state][act][0];
              poff[1] += self.uc_payoffs[sit][state][act][1];
            }
            else {
              random_comp = [0.0, 0.0];

              self.actions.forEach(function (rand_act){
                if (rand_act === 'a3') return;

                random_comp[0] += self.uc_payoffs[sit][state][rand_act][0];
                random_comp[1] += self.uc_payoffs[sit][state][rand_act][1];
              });

              random_comp[0] /= self.states.length;
              random_comp[1] /= self.states.length;

              // poff[0] += act_prob * (1.0 - self.inspect_prob) * random_comp[0];
              // poff[0] += act_prob * self.inspect_prob * self.uc_payoffs[sit][state][self.codes.action + state.substring(1)][0];

              // poff[1] += act_prob * (1.0 - self.inspect_prob) * random_comp[1];
              // poff[1] += act_prob * self.inspect_prob * self.uc_payoffs[sit][state][self.codes.action + state.substring(1)][1];

              poff[0] += (1.0 - self.inspect_prob) * random_comp[0];
              poff[0] += self.inspect_prob * self.uc_payoffs[sit][state][self.codes.action + state.substring(1)][0];

              poff[1] += (1.0 - self.inspect_prob) * random_comp[1];
              poff[1] += self.inspect_prob * self.uc_payoffs[sit][state][self.codes.action + state.substring(1)][1];
            }
          }

          payoffs[sit][state][msg][act] = {probability: act_prob, payoffs: poff};
        });
      });
    });
  });

  return payoffs;
};

SelfDeceptionAnalyzer.prototype.calculateBestMessages = function (receiver_maps){
  var payoffs = this.uc_payoffs_byaction || this.calculateByActionUCPayoffs(receiver_maps);
  var best_messages = {};

  var self = this;
  self.situations.forEach(function (sit){
    best_messages[sit] = {};

    self.states.forEach(function (state){
      best_messages[sit][state] = _.max(_.map(payoffs[sit][state], function (msg_obj, msg){ 
        var avg_payoffs = [0.0, 0.0];
        var poffs;
        for (var act in msg_obj){
          poffs = msg_obj[act];
          avg_payoffs[0] += poffs.probability * poffs.payoffs[0];
          avg_payoffs[1] += poffs.probability * poffs.payoffs[1];  
        }
        return {message: msg, payoffs: avg_payoffs}; 
      }), function (item){ return item.payoffs[1]; });
    });
  });

  return best_messages;
};

SelfDeceptionAnalyzer.prototype.deceptionOnMessagesAndSituations = function (repr, state, u_maps, c_maps){
  //Assume misuse
  // var misuse = this.misuse(message, state, sender_maps);

  // if (misuse){
    //misuse implies use
  var self = this;
  var pcts = {};
  self.situations.forEach(function (sit){
    var sitpcts = self.deceptionOnMessages(repr, state, sit, u_maps, c_maps);
    // console.log("SitPcts:");
    // console.log(sitpcts);
    if (Object.keys(sitpcts).length > 0){
      pcts[sit] = sitpcts;  
    }
  });

  return pcts;
  // }
  // else {
  //   return 0;
  // }
};

SelfDeceptionAnalyzer.prototype.deceptionOnMessages = function (repr, state, sit, u_maps, c_maps){
  var pcts = {};
  var self = this;

  var possible_msgs = Object.keys(c_maps[sit][repr]);
  // console.log("PossibleMsgs");
  // console.log(possible_msgs);
    
  possible_msgs.forEach(function (msg){
    pcts[msg] = {};
    for (var act in self.uc_payoffs_byaction[sit][state][msg]){
      if (self.uc_payoffs_byaction[sit][state][msg][act].probability > 0.0){
        var actual_payoffs = _.map(self.uc_payoffs_byaction[sit][state][msg][act].payoffs, function (payoff){ 
              if (state === repr){
                return payoff + self.decision_contrib;
              }
              else {
                return payoff;
              }
            });
        var best_message = self.best_messages[sit][state].message
          , best_message_payoffs = _.map(self.best_messages[sit][state].payoffs, function (payoff){
              if (state === repr){
                return payoff + self.decision_contrib;
              }
              else {
                return payoff;
              }
            })
          ;
        // console.log("Details");
        // console.log(actual_payoffs);
        // console.log(best_message);
        // console.log(best_message_payoffs);

        //sender benefit
        if (actual_payoffs[0] > best_message_payoffs[0] && repr !== state){
          pcts[msg][act] = c_maps[sit][repr][msg] * self.uc_payoffs_byaction[sit][state][msg][act].probability;
        }

        //receiver detriment -- strange for self-deception calculation
        // if (actual_payoffs[1] >= best_action_payoffs[1]){
        //   return;
        // }
      }
    }

    if (Object.keys(pcts[msg]).length === 0){
      delete pcts[msg];
    }
  });

  return pcts;
};

function ExtDeceptionAnalyzer(num_states, num_messages, num_actions, num_situations, inspect_cost, base_cr_payoffs, unconscious_maps, codes){
  this.codes = codes || {};
  if (!this.codes.state) this.codes.state = 'q';
  if (!this.codes.message) this.codes.message = 'm';
  if (!this.codes.action) this.codes.action = 'a';
  if (!this.codes.situation) this.codes.situation = 's';

  this.states = [];
  this.messages = [];
  this.actions = [];
  this.situations = [];
  this.inspect_prob = inspect_prob;
  this.inspect_cost = inspect_cost;

  this.cr_payoffs = base_cr_payoffs;

  this.repr_probs = {};

  var i;
  
  for (i = 0; i < num_states; i++){
    this.states.push(this.codes.state+i);

    this.repr_probs[this.codes.state+i] = 0.0;
    for (var state in unconscious_maps){
      this.repr_probs[this.codes.state+i] += unconscious_maps[state][this.codes.state+i] / num_states;
    }
  }

  for (i = 0; i < num_messages; i++){
    this.messages.push(this.codes.message+i);
  }

  for (i = 0; i < num_actions; i++){
    this.actions.push(this.codes.action+i);
  }

  for (i = 0; i < num_situations; i++){
    this.situations.push(this.codes.situation+i);
  }
  
  this.best_actions = this.calculateBestActions();
}

ExtDeceptionAnalyzer.prototype.calculateBestActions = function (){
  var best_actions = {};
  var self = this;

  self.situations.forEach(function (sit){
    best_actions[sit] = {};

    self.states.forEach(function (state){
      best_actions[sit][state] = [];

      self.actions.forEach(function (act){
        var poffs;
        if (act !== 'a3'){
          poffs = self.cr_payoffs[sit][state][act];
        }
        else {

        }

        if (best_actions[sit][state].length === 0 || best_actions[sit][state][0].payoffs[2] === poffs[2]){
          best_actions[sit][state].push({action: act, payoffs: poffs});
        }
        else if (best_actions[sit][state][0].payoffs[2] < poffs[2]){
          best_actions[sit][state] = [{action: act, payoffs: poffs}];
        }
      });
    });
  });

  return best_actions;
}

ExtDeceptionAnalyzer.prototype.deception = function (msg, state, sit, c_maps, r_maps){
  //we assume misuse already
  var pcts = {};
  var self = this;

  var possible_acts = Object.keys(c_maps[sit][msg]);
  var best_actions = this.best_actions[sit][state];
    
  possible_acts.forEach(function (act){
    pcts[act] = {};
    var act_add = '';

    if (act === 'a3'){
      self.actions.forEach(function (rand_act){
        if (rand_act === 'a3') return;

        var actual_payoffs = _.clone(self.cr_payoffs[sit][state][rand_act]);
        actual_payoffs[2] -= self.inspect_cost;

        var deceptions = _real_deception(best_actions, actual_payoffs);

        deceptions.forEach(function (dec_ba){
          if (!pcts[act][state]){
            pcts[act][state] = {};
          }

          if (!pcts[act][state][rand_act]){
            pcts[act][state][rand_act] = []
          }

          pcts[act][state][rand_act].push({best_action: dec_ba});  
        });
      });
    }
    else {
      var actual_payoffs = self.cr_payoffs[sit][state][act];

      var deceptions = _real_deception(best_actions, actual_payoffs);

      deceptions.forEach(function (dec_ba){
        if (!pcts[act][state]){
          pcts[act][state] = [];
        }

        pcts[act][state].push({best_action: dec_ba});  
      });
    }


    function _real_deception(best_acts, actual_payoffs){
      var rets = [];
      best_acts.forEach(function (best_action){
        if (actual_payoffs[1] > best_action.payoffs[1] && actual_payoffs[2] < best_action.payoffs[2]){
          rets.push(best_action);
        }
      });

      return rets;
    }

    if (Object.keys(pcts[act]).length === 0){
      delete pcts[act];
    }
  });

  return pcts;
};
