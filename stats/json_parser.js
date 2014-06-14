var args = require("optimist")
      .usage("$0 --stats <statsfile> --out <outfile>")
      .demand(["out", "stats"])
      .alias({"out": "o", "stats": "s"})
      .describe({ "out": "The file to output with data."
                , "stats": "The stats file to parse."})
      .argv
  , fs = require("fs")
  , path = require("path")
  , sl = require("./stats_lib")
  , _ = require("underscore")
  ;

try {
  var data = require(path.resolve(args.stats));
} catch (e) {
  console.log("Unable to find file %s", args.stats);
  process.exit(-1);
}

var wstream = fs.createWriteStream(args.out);
wstream.on("error", function (err){
  console.log("Write stream error:");
  console.log(err);
});

wstream.on("open", function (){
  var stats = parseStats(data);
  wstream.end(JSON.stringify(stats, null, 2), "utf8", function (){
    console.log("Stats written successfully.");
  });
});

function basePayoffs(params){
  return {
    s0: {
      'q0': {'a0': [params.o,params.o,1.0], 'a1': [0.0,0.0,0.0], 'a2': [0.0,0.0,0.0]}
    , 'q1': {'a0': [0.0,0.0,0.0], 'a1': [params.o,params.o,1.0], 'a2': [0.0,0.0,0.0]}
    , 'q2': {'a0': [0.0,0.0,0.0], 'a1': [0.0,0.0,0.0], 'a2': [params.o,params.o,1.0]}
    }
  , s1: {
      'q0': {'a0': [0.0,0.0,1.0], 'a1': [params.o,params.o,0.0], 'a2': [0.0,0.0,0.0]}
    , 'q1': {'a0': [params.o,params.o,0.0], 'a1': [0.0,0.0,1.0], 'a2': [0.0,0.0,0.0]}
    , 'q2': {'a0': [0.0,0.0,0.0], 'a1': [0.0,0.0,0.0], 'a2': [params.o,params.o,1.0]}
    }
  };
};

function parseStats(data){
  var states = 3
    , messages = 3
    , actions = 4
    , situations = 2
    , state_probs = {q0: 1.0/3.0, q1: 1.0/3.0, q2: 1.0/3.0}
    , br = {
        'q0': 'a0'
      , 'q1': 'a1'
      , 'q2': 'a2'
      }
    ;

  var ret = {
    mostly_true_rep: {} //Mostly true rep?
  , totally_true_rep: {} //Totally true rep?
  , all_mostly_true_rep: {} //All mostly true rep?
  , all_totally_true_rep: {} //All totally true rep?
  , not_totally_true_rep: {} //Not all totally true?
  , not_mostly_true_rep: {} //Not all mostly true?
  , mixed_strat_rep: {} //Internal mixing?
  , mixed_strat_s0: {} //External mixing in s0?
  , mixed_strat_s1: {} //External mixing in s1?
  , inspecting_s0: {} //Inspection in s0?
  , inspecting_s1: {} //Inspection in s1?
  , internal_misuse: {} //Internal misuse?
  , self_deception_s0: {} //Self-Deception? (loop)
  , self_deception_s1: {} //Self-Deception? (loop)
  , self_deception_s0_a3_correct: {}
  , self_deception_s1_a3_correct: {}
  , conscious_misuse_s0: {} //External misuse? (loop)
  , conscious_misuse_s1: {} //External misuse? (loop)
  , conscious_deception_s0: {} //External deception? (loop)
  , conscious_deception_s1: {} //External deception? (loop)
  , conscious_deception_s0_a3_correct: {} //Deception when correctly inspecting? (loop)
  , conscious_deception_s1_a3_correct: {} //Deception when correctly inspecting? (loop)
  , conscious_deception_s0_a3_correct_self: {} //Self-and-other deception? (loop)
  , conscious_deception_s1_a3_correct_self: {} //Self-and-other deception? (loop)
  , whole_misuse_s0: {} //Whole misuse? (loop)
  , whole_misuse_s1: {} //Whole misuse? (loop)
  , whole_deception_s0: {} //Whole deception? (loop)
  , whole_deception_s1: {} //Whole deception? (loop)
  , whole_deception_s0_a3: {}
  , whole_deception_s1_a3: {}
  , whole_deception_s0_fromConscious: {}
  , whole_deception_s1_fromConscious: {}
  , whole_deception_s0_fromSelf: {}
  , whole_deception_s1_fromSelf: {}
  , whole_deception_s0_fromBoth: {}
  , whole_deception_s1_fromBoth: {}
  , whole_deception_s0_fromNeither: {}
  , whole_deception_s1_fromNeither: {}
  , pct_inspecting_s0: {}
  , pct_inspecting_s1: {}
  };

  function determineParameters(dup){
    var params = {
      p: 0.0
    , c: 0.0
    , o: 0.0
    , s: 0.5
    };

    //see if we're being called from a weird place

    //being called from within the o-directory
    var matches;
    matches = process.cwd().match(/s_(.*)_o_(.*)\.results/i);
    if (matches){
      params.s = parseFloat(matches[1])
      params.o = parseFloat(matches[2]);
    }

    matches = args.stats.match(/p_(.*)_c_(.*\d)(?:\.[^\d]|$)/);
    if (matches){
      params.p = parseFloat(matches[1]);
      params.c = parseFloat(matches[2]);
    }

    return params;
  }

  var params = determineParameters();
  //console.log(params);

  function mostlyTrueRep(UMap, file){
    for (var key in UMap){
      //Mostly true rep? is the state represented correctly at least 40% of the time?
      if (UMap[key][key] && UMap[key][key] >= 0.4){
        if (!ret.mostly_true_rep[file]){
          ret.mostly_true_rep[file] = [];
        }

        ret.mostly_true_rep[file].push(key);

        //All mostly true rep? Is this the case in every state of the world?
        if (ret.mostly_true_rep[file].length === states){
          ret.all_mostly_true_rep[file] = true;
        }
      }
    }
  }

  function totallyTrueRep(UMap, file){
    for (var key in UMap){
      //Totally true rep? is the state represented correctly all of the time?
      if (UMap[key][key] && (Object.keys(UMap[key]).length === 1 || UMap[key][key] > 0.995)){
        if (!ret.totally_true_rep[file]){
          ret.totally_true_rep[file] = [];
        }

        ret.totally_true_rep[file].push(key);

        //All totally true rep? Is this the case in every state of the world?
        if (ret.totally_true_rep[file].length === states){
          ret.all_totally_true_rep[file] = true;
        }
      }
    }
  }

  function internalMixing(UMap, file){
    for (var key in UMap){
      //Internal mixing? is there a mixed strategy of representation?
      if (Object.keys(UMap[key]).length > 1 && _.filter(Object.keys(UMap[key]), function (k){return UMap[key][k] > 0.005}).length > 1){
        if (!ret.mixed_strat_rep[file]){
          ret.mixed_strat_rep[file] = [];
        }

        ret.mixed_strat_rep[file].push(key);
      }
    }
  }

  function externalMixing(sit, CMap, file){
    for (var key in CMap[sit]){
      //is there a mixed strategy of representation?
      if (Object.keys(CMap[sit][key]).length > 1 && _.filter(Object.keys(CMap[sit][key]), function (k){return CMap[sit][key][k] > 0.005}).length > 1){
        if (!ret["mixed_strat_"+sit][file]){
          ret["mixed_strat_"+sit][file] = [];
        }

        ret["mixed_strat_"+sit][file].push(key);
      }
    }
  }

  function inspecting(sit, UMap, CMap, RMap, file){
    var rep, state, prob_msg;
    for (var msg in RMap[sit]){
      //given key message, does the receiver inspect a fair bit?
      if (RMap[sit][msg]['a3']){
        if (RMap[sit][msg]['a3'] > 0.01){
          if (!ret["inspecting_"+sit][file]){
            ret["inspecting_"+sit][file] = [];
          }

          ret["inspecting_"+sit][file].push([msg, RMap[sit][msg]['a3']]);
        }

        prob_msg = 0.0;

        for (rep in CMap[sit]){
          if (CMap[sit][rep][msg]){
            for (state in UMap){
              if (UMap[state][rep]){
                prob_msg += UMap[state][rep] * CMap[sit][rep][msg] * state_probs[state];
              }
            }
          }
        }

        if (!ret["pct_inspecting_"+sit][file]){
          ret["pct_inspecting_"+sit][file] = 0.0;
        }

        ret["pct_inspecting_"+sit][file] += prob_msg * RMap[sit][msg]['a3'];
      }
    }
  }

  function internalMisuseDeception(base_payoffs, params, file, UMap, CMap, RMap){
    //Internal misuse? check for internal misuse of representations
    var internal_analyzer = new sl.InformationAnalyzer(states, states, state_probs, {state: 'q', message: 'q'});
    var sd_analyzer = new sl.SelfDeceptionAnalyzer(states, messages, actions, situations, params.p, 1.0-params.o, base_payoffs, RMap);
    var pure_sender_strats = internal_analyzer.generatePureSenderStrategies(UMap);
    var misuse;
    for (var st in UMap){
      for (var r in UMap[st]){
        misuse = false;
        pure_sender_strats.forEach(function (sender_data){
          if (internal_analyzer.misuse(sender_data, UMap, r, st)){
            if (!ret.internal_misuse[file]){
              ret.internal_misuse[file] = []
            }

            ret.internal_misuse[file].push({sender_strat: sender_data, state: st, representation: r, probability: UMap[st][r]});
            misuse = true;
          }
        });

        if (misuse){
          //Self-Deception? there is misuse -- check for self-deception
          var sit_dec_data = sd_analyzer.deceptionOnMessagesAndSituations(r, st, UMap, CMap);
          if (Object.keys(sit_dec_data).length > 0){
            for (var sitkey in sit_dec_data){
              if (!ret["self_deception_"+sitkey][file]){
                ret["self_deception_"+sitkey][file] = [];
              }

              ret["self_deception_"+sitkey][file].push({state: st, representation: r, messages: sit_dec_data[sitkey]});
            }
          }
        }
      }
    }
  }

  function consciousMisuseDeception(base_payoffs, params, file, UMap, CMap, RMap){
    var rep_probs = {'q0': 0.0, 'q1': 0.0, 'q2': 0.0};
    for (var st in UMap){
      for (var r in UMap[st]){
        rep_probs[r] += UMap[st][r] * state_probs[st];
      }
    }

    var external_analyzer = new sl.InformationAnalyzer(states, messages, rep_probs, {state: 'q', message: 'm'});
    var dec_analyzer = new sl.ExtDeceptionAnalyzer(states, messages, actions, situations, params.p, params.c, base_payoffs);
    var sit;
    var pure_sender_strats;
    var misuse_rep_msg;
    var st;
    var dec_data;
    var push_data;

    for (var siti = 0; siti < situations; siti++){
      sit = 's'+siti;
      pure_sender_strats = external_analyzer.generatePureSenderStrategies(CMap[sit]);

      for (var rep in CMap[sit]){
        for (var msg in CMap[sit][rep]){
          misuse_rep_msg = pure_sender_strats.some(function (sender_data){
            if (external_analyzer.misuse(sender_data, CMap[sit], msg, rep)){
              return true;
            }
          });

          if (misuse_rep_msg){
            if (!ret["conscious_misuse_"+sit][file]){
              ret["conscious_misuse_"+sit][file] = {}
            }

            ret["conscious_misuse_"+sit][file][rep+"-"+msg] = CMap[sit][rep][msg];

            //External deception? there is misuse -- check for deception
            for (var stai = 0; stai < states; stai++){
              st = 'q'+stai;
              //that representation is used in that state
              if (UMap[st][rep] > 0.0){
                dec_data = dec_analyzer.deception(msg, st, sit, CMap, RMap);

                if (Object.keys(dec_data).length > 0){
                  //yes, there is deception

                  if (!ret["conscious_deception_"+sit][file]){
                    ret["conscious_deception_"+sit][file] = {};
                  }

                  if (!ret["conscious_deception_"+sit][file][st+"-"+rep+"-"+msg]){
                    ret["conscious_deception_"+sit][file][st+"-"+rep+"-"+msg] = {};
                  }

                  for (var act in dec_data){
                    ret["conscious_deception_"+sit][file][st+"-"+rep+"-"+msg][act] = dec_data[act];

                    //Deception when correctly inspecting?
                    // is this a case of inspecting and is the inspection correct?
                    if (act === "a3" && dec_data[act]['a'+rep.substring(1)]){
                      if (!ret["conscious_deception_"+sit+"_a3_correct"][file]){
                        ret["conscious_deception_"+sit+"_a3_correct"][file] = [];
                      }

                      push_data = {state: st, representation: rep, message: msg, a3action: 'a'+rep.substring(1)};
                      ret["conscious_deception_"+sit+"_a3_correct"][file].push(push_data);

                      //Self-and-other deception?
                      if (_.filter(ret["self_deception_"+sit][file], function (sditem){ return sditem.state === st && sditem.representation === r}).length){
                        if (!ret["conscious_deception_"+sit+"_a3_correct_self"][file]){
                          ret["conscious_deception_"+sit+"_a3_correct_self"][file] = [];
                        }

                        ret["conscious_deception_"+sit+"_a3_correct_self"][file].push(push_data);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

  }

  function wholeMisuseDeception(base_payoffs, params, file, UMap, CMap, RMap){
    var whole_analyzer = new sl.InformationAnalyzer(states, messages, state_probs, {state: 'q', message: 'm'});
    var whole_dec_analyzer = new sl.ExtDeceptionAnalyzer(states, messages, actions, situations, params.p, params.c, base_payoffs);

    var sit;
    var wholeMap = {s0: {}, s1: {}};
    for (var siti = 0; siti < situations; siti++){
      sit = 's'+siti;

      for (var ustate in UMap){
        wholeMap[sit][ustate] = wholeMap[sit][ustate] || {};
        for (var urep in UMap[ustate]){
          for (var cmsg in CMap[sit][urep]){
            wholeMap[sit][ustate][cmsg] = (wholeMap[sit][ustate][cmsg] || 0) + UMap[ustate][urep] * CMap[sit][urep][cmsg];
          }
        }
      }
    }

    var whole_pure_sender_strats;
    var misuse_sta_msg;
    var whole_dec_data;
    var maybe_both;
    var maybe_neither;

    for (var siti = 0; siti < situations; siti++){
      //Whole misuse?
      whole_pure_sender_strats = whole_analyzer.generatePureSenderStrategies(wholeMap[sit]);
      for (var sta in wholeMap[sit]){
        for (var msg in wholeMap[sit][sta]){
          misuse_sta_msg = whole_pure_sender_strats.some(function (sender_data){
            if (whole_analyzer.misuse(sender_data, wholeMap[sit], msg, sta)){
              return true;
            }
          });

          if (misuse_sta_msg){
            if (!ret["whole_misuse_"+sit][file]){
              ret["whole_misuse_"+sit][file] = {}
            }

            ret["whole_misuse_"+sit][file][sta+"-"+msg] = wholeMap[sit][sta][msg];

            //Whole deception? there is misuse -- check for deception
            whole_dec_data = whole_dec_analyzer.deception(msg, sta, sit, wholeMap, RMap);

            if (Object.keys(whole_dec_data).length > 0){
              //yes, there is deception

              if (!ret["whole_deception_"+sit][file]){
                ret["whole_deception_"+sit][file] = {};
              }

              if (!ret["whole_deception_"+sit][file][sta+"-"+msg]){
                ret["whole_deception_"+sit][file][sta+"-"+msg] = {};
              }

              for (var act in whole_dec_data){
                ret["whole_deception_"+sit][file][sta+"-"+msg][act] = whole_dec_data[act];

                if (act === 'a3'){
                  if (!ret["whole_deception_"+sit+"_a3"][file]){
                    ret["whole_deception_"+sit+"_a3"][file] = {};
                  }
                  ret["whole_deception_"+sit+"_a3"][file][sta+"-"+msg] = whole_dec_data[act];
                }

                //Whole deception from conscious?
                for (var repi = 0; repi < states; repi++){
                  maybe_both = false;
                  maybe_neither = true;

                  //might this representation be part of the chain?
                  if (!UMap[sta]["q"+repi]){
                    continue;
                  }

                  //is there conscious misuse?
                  if ((ret["conscious_misuse_"+sit][file] || {})["q"+repi+"-"+msg]){
                    maybe_both = true;
                  }

                  //was the misuse from the unconscious contribution?
                  if ((ret["internal_misuse"][file] || []).some(function (item){return item.state === sta && item.representation === "q"+repi;})){
                    if (maybe_both){
                      if (!ret["whole_deception_"+sit+"_fromBoth"][file]){
                        ret["whole_deception_"+sit+"_fromBoth"][file] = {};
                      }
                      ret["whole_deception_"+sit+"_fromBoth"][file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                    }
                    else {
                      if (!ret["whole_deception_"+sit+"_fromSelf"][file]){
                        ret["whole_deception_"+sit+"_fromSelf"][file] = {};
                      }
                      ret["whole_deception_"+sit+"_fromSelf"][file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                    }
                  }
                  else if (maybe_both){
                    if (!ret["whole_deception_"+sit+"_fromConscious"][file]){
                      ret["whole_deception_"+sit+"_fromConscious"][file] = {};
                    }
                    ret["whole_deception_"+sit+"_fromConscious"][file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                  }
                  else {
                    if (!ret["whole_deception_"+sit+"_fromNeither"][file]){
                      ret["whole_deception_"+sit+"_fromNeither"][file] = {};
                    }
                    ret["whole_deception_"+sit+"_fromNeither"][file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                  }
                }
              }
            }
          }
        }
      }
    }


  }

  data.forEach(function (dup){
    if (!dup){
      console.error("No duplication object.");
      return;
    }

    mostlyTrueRep(dup.data.UMap, dup.file);
    totallyTrueRep(dup.data.UMap, dup.file);

    //Not all mostly true?
    if (!ret.all_mostly_true_rep[dup.file]){
      ret.not_mostly_true_rep[dup.file] = ret.mostly_true_rep[dup.file] || [];
    }

    //Not all totally true?
    if (!ret.all_totally_true_rep[dup.file]){
      ret.not_totally_true_rep[dup.file] = ret.totally_true_rep[dup.file] || [];
    }

    internalMixing(dup.data.UMap, dup.file);
    externalMixing('s0', dup.data.CMap, dup.file);
    externalMixing('s1', dup.data.CMap, dup.file);
    inspecting('s0', dup.data.UMap, dup.data.CMap, dup.data.RMap, dup.file);
    inspecting('s1', dup.data.UMap, dup.data.CMap, dup.data.RMap, dup.file);

    var base_payoffs = basePayoffs(params);

    internalMisuseDeception(base_payoffs, params, dup.file, dup.data.UMap, dup.data.CMap, dup.data.RMap);
    consciousMisuseDeception(base_payoffs, params, dup.file, dup.data.UMap, dup.data.CMap, dup.data.RMap);
    wholeMisuseDeception(base_payoffs, params, dup.file, dup.data.UMap, dup.data.CMap, dup.data.RMap);

  });

  var counts = {};
  for (var stat in ret){
    if (["pct_inspecting_s0", "pct_inspecting_s1"].indexOf(stat) === -1){
      counts[stat] = _.filter(Object.keys(ret[stat]), function (statline){return statline !== 0 && !_.isEmpty(statline);}).length;
    }
    else {
      var slen = _.filter(Object.keys(ret[stat]), function (statline){return statline !== 0 && !_.isEmpty(statline);}).length;
      counts[stat] = 0;
      for (var file in ret[stat]){
        counts[stat] += ret[stat][file] / slen;
      }
    }
  }

  return [counts,ret];
}