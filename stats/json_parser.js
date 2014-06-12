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

  data.forEach(function (dup){
    if (!dup){
      console.error("No duplication object.");
      return;
    }

    mostlyTrueRep(dup.data.UMap, dup.file);
    totallyTrueRep(dup.data.UMap, dup.file);

    var key;

    for (key in dup.data.UMap){

      //Internal mixing? is there a mixed strategy of representation?
      if (Object.keys(dup.data.UMap[key]).length > 1 && _.filter(Object.keys(dup.data.UMap[key]), function (k){return dup.data.UMap[key][k] > 0.005}).length > 1){
        if (!ret.mixed_strat_rep[dup.file]){
          ret.mixed_strat_rep[dup.file] = [];
        }

        ret.mixed_strat_rep[dup.file].push(key);
      }
    }

    //External mixing in s0?
    for (key in dup.data.CMap['s0']){
      //is there a mixed strategy of representation?
      if (Object.keys(dup.data.CMap['s0'][key]).length > 1 && _.filter(Object.keys(dup.data.CMap['s0'][key]), function (k){return dup.data.CMap['s0'][key][k] > 0.005}).length > 1){
        if (!ret.mixed_strat_s0[dup.file]){
          ret.mixed_strat_s0[dup.file] = [];
        }

        ret.mixed_strat_s0[dup.file].push(key);
      }
    }

    //External mixing in s1?
    for (key in dup.data.CMap['s1']){
      //is there a mixed strategy of representation?
      if (Object.keys(dup.data.CMap['s1'][key]).length > 1 && _.filter(Object.keys(dup.data.CMap['s1'][key]), function (k){return dup.data.CMap['s1'][key][k] > 0.005}).length > 1){
        if (!ret.mixed_strat_s1[dup.file]){
          ret.mixed_strat_s1[dup.file] = [];
        }

        ret.mixed_strat_s1[dup.file].push(key);
      }
    }

    //Inspection in s0?
    for (key in dup.data.RMap['s0']){
      //given key message, does the receiver inspect a fair bit?
      if (dup.data.RMap['s0'][key]['a3'] && dup.data.RMap['s0'][key]['a3'] > 0.01){
        if (!ret.inspecting_s0[dup.file]){
          ret.inspecting_s0[dup.file] = [];
        }

        ret.inspecting_s0[dup.file].push([key, dup.data.RMap['s0'][key]['a3']])
      }
    }

    //Inspection in s1?
    for (key in dup.data.RMap['s1']){
      if (dup.data.RMap['s1'][key]['a3'] && dup.data.RMap['s1'][key]['a3'] > 0.01){
        if (!ret.inspecting_s1[dup.file]){
          ret.inspecting_s1[dup.file] = [];
        }

        ret.inspecting_s1[dup.file].push([key, dup.data.RMap['s1'][key]['a3']])
      }
    }

    //Not all mostly true?
    if (!ret.all_mostly_true_rep[dup.file]){
      ret.not_mostly_true_rep[dup.file] = ret.mostly_true_rep[dup.file] || [];
    }

    //Not all totally true?
    if (!ret.all_totally_true_rep[dup.file]){
      ret.not_totally_true_rep[dup.file] = ret.totally_true_rep[dup.file] || [];
    }

    var base_payoffs = basePayoffs(params);

    //Internal misuse? check for internal misuse of representations
    var internal_analyzer = new sl.InformationAnalyzer(states, states, state_probs, {state: 'q', message: 'q'});
    var sd_analyzer = new sl.SelfDeceptionAnalyzer(states, messages, actions, situations, params.p, 1.0-params.o, base_payoffs, dup.data.RMap);
    var pure_sender_strats = internal_analyzer.generatePureSenderStrategies(dup.data.UMap);
    var misuse;
    for (var st in dup.data.UMap){
      for (var r in dup.data.UMap[st]){
        misuse = false;
        pure_sender_strats.forEach(function (sender_data){
          if (internal_analyzer.misuse(sender_data, dup.data.UMap, r, st)){
            if (!ret.internal_misuse[dup.file]){
              ret.internal_misuse[dup.file] = []
            }

            ret.internal_misuse[dup.file].push({sender_strat: sender_data, state: st, representation: r, probability: dup.data.UMap[st][r]});
            misuse = true;
          }
        });

        if (misuse){
          //Self-Deception? there is misuse -- check for self-deception
          var sit_dec_data = sd_analyzer.deceptionOnMessagesAndSituations(r, st, dup.data.UMap, dup.data.CMap);
          if (Object.keys(sit_dec_data).length > 0){
            for (var sitkey in sit_dec_data){
              if (!ret["self_deception_"+sitkey][dup.file]){
                ret["self_deception_"+sitkey][dup.file] = [];
              }

              ret["self_deception_"+sitkey][dup.file].push({state: st, representation: r, messages: sit_dec_data[sitkey]});
            }
          }
        }
      }
    }

    //External misuse? check for other-deception
    var st;
    var rep_probs = {'q0': 0.0, 'q1': 0.0, 'q2': 0.0};
    for (st in dup.data.UMap){
      for (var r in dup.data.UMap[st]){
        rep_probs[r] += dup.data.UMap[st][r] * state_probs[st];
      }
    }


    var sit, siti, stai;
    var pure_sender_strats, whole_pure_sender_strats;
    var sta, rep, msg;
    var misuse_rep_msg;
    var push_data;
    var external_analyzer = new sl.InformationAnalyzer(states, messages, rep_probs, {state: 'q', message: 'm'});
    var whole_analyzer = new sl.InformationAnalyzer(states, messages, state_probs, {state: 'q', message: 'm'});
    var dec_analyzer = new sl.ExtDeceptionAnalyzer(states, messages, actions, situations, params.p, params.c, base_payoffs);
    var whole_dec_analyzer = new sl.ExtDeceptionAnalyzer(states, messages, actions, situations, params.p, params.c, base_payoffs);

    var wholeMap = {s0: {}, s1: {}};
    for (siti = 0; siti < situations; siti++){
      sit = 's'+siti;

      for (var ustate in dup.data.UMap){
        wholeMap[sit][ustate] = wholeMap[sit][ustate] || {};
        for (var urep in dup.data.UMap[ustate]){
          for (var cmsg in dup.data.CMap[sit][urep]){
            wholeMap[sit][ustate][cmsg] = (wholeMap[sit][ustate][cmsg] || 0) + dup.data.UMap[ustate][urep] * dup.data.CMap[sit][urep][cmsg];
          }
        }
      }
    }

    for (siti = 0; siti < situations; siti++){
      sit = 's'+siti;
      pure_sender_strats = external_analyzer.generatePureSenderStrategies(dup.data.CMap[sit]);

      for (rep in dup.data.CMap[sit]){
        for (msg in dup.data.CMap[sit][rep]){
          misuse_rep_msg = pure_sender_strats.some(function (sender_data){
            if (external_analyzer.misuse(sender_data, dup.data.CMap[sit], msg, rep)){
              return true;
            }
          });

          if (misuse_rep_msg){
            if (!ret["conscious_misuse_"+sit][dup.file]){
              ret["conscious_misuse_"+sit][dup.file] = {}
            }

            ret["conscious_misuse_"+sit][dup.file][rep+"-"+msg] = dup.data.CMap[sit][rep][msg];
            // ret["conscious_misuse_"+sit][dup.file].push({sender_strat: sender_data, representation: rep, message: msg, probability: dup.data.CMap[sit][rep][msg]});

            //External deception? there is misuse -- check for deception
            for (stai = 0; stai < states; stai++){
              st = 'q'+stai;
              //that representation is used in that state
              if (dup.data.UMap[st][rep] > 0.0){
                var dec_data = dec_analyzer.deception(msg, st, sit, dup.data.CMap, dup.data.RMap);

                //console.log(dec_data);

                if (Object.keys(dec_data).length > 0){
                  //yes, there is deception

                  if (!ret["conscious_deception_"+sit][dup.file]){
                    ret["conscious_deception_"+sit][dup.file] = {};
                  }
            
                  if (!ret["conscious_deception_"+sit][dup.file][st+"-"+rep+"-"+msg]){
                    ret["conscious_deception_"+sit][dup.file][st+"-"+rep+"-"+msg] = {};
                  }

                  for (var act in dec_data){
                    ret["conscious_deception_"+sit][dup.file][st+"-"+rep+"-"+msg][act] = dec_data[act];

                    //Deception when correctly inspecting?
                    // is this a case of inspecting and is the inspection correct?
                    if (act === "a3" && dec_data[act]['a'+rep.substring(1)]){
                      if (!ret["conscious_deception_"+sit+"_a3_correct"][dup.file]){
                        ret["conscious_deception_"+sit+"_a3_correct"][dup.file] = [];
                      }

                      push_data = {state: st, representation: rep, message: msg, a3action: 'a'+rep.substring(1)};
                      ret["conscious_deception_"+sit+"_a3_correct"][dup.file].push(push_data);

                      //Self-and-other deception?
                      //if (_.filter(ret["self_deception_"+sit][dup.file], function (sditem){ return sditem.state === st && sditem.representation === r}).length){
                      if (_.filter(ret["self_deception_"+sit][dup.file], function (sditem){ return sditem.representation === r}).length){
                        if (!ret["conscious_deception_"+sit+"_a3_correct_self"][dup.file]){
                          ret["conscious_deception_"+sit+"_a3_correct_self"][dup.file] = [];
                        }

                        ret["conscious_deception_"+sit+"_a3_correct_self"][dup.file].push(push_data);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      //Whole misuse?
      whole_pure_sender_strats = whole_analyzer.generatePureSenderStrategies(wholeMap[sit]);
      for (sta in wholeMap[sit]){
        for (msg in wholeMap[sit][sta]){
          misuse_sta_msg = whole_pure_sender_strats.some(function (sender_data){
            if (whole_analyzer.misuse(sender_data, wholeMap[sit], msg, sta)){
              return true;
            }
          });

          if (misuse_sta_msg){
            if (!ret["whole_misuse_"+sit][dup.file]){
              ret["whole_misuse_"+sit][dup.file] = {}
            }

            ret["whole_misuse_"+sit][dup.file][sta+"-"+msg] = wholeMap[sit][sta][msg];

            //Whole deception? there is misuse -- check for deception
            var whole_dec_data = whole_dec_analyzer.deception(msg, sta, sit, wholeMap, dup.data.RMap);

            if (Object.keys(whole_dec_data).length > 0){
              //yes, there is deception

              if (!ret["whole_deception_"+sit][dup.file]){
                ret["whole_deception_"+sit][dup.file] = {};
              }

              if (!ret["whole_deception_"+sit][dup.file][sta+"-"+msg]){
                ret["whole_deception_"+sit][dup.file][sta+"-"+msg] = {};
              }

              for (var act in whole_dec_data){
                ret["whole_deception_"+sit][dup.file][sta+"-"+msg][act] = whole_dec_data[act];

                if (act === 'a3'){
                  if (!ret["whole_deception_"+sit+"_a3"][dup.file]){
                    ret["whole_deception_"+sit+"_a3"][dup.file] = {};
                  }
                  ret["whole_deception_"+sit+"_a3"][dup.file][sta+"-"+msg] = whole_dec_data[act];
                }

                //Whole deception from conscious?
                for (var repi = 0; repi < states; repi++){
                  var maybe_both = false;
                  var maybe_neither = true;

                  //might this representation be part of the chain?
                  if (!dup.data.UMap[sta]["q"+repi]){
                    continue;
                  }

                  //is there conscious misuse?
                  if ((ret["conscious_misuse_"+sit][dup.file] || {})["q"+repi+"-"+msg]){
                    maybe_both = true;
                    maybe_neither = false;
                    if (!ret["whole_deception_"+sit+"_fromConscious"][dup.file]){
                      ret["whole_deception_"+sit+"_fromConscious"][dup.file] = {};
                    }
                    ret["whole_deception_"+sit+"_fromConscious"][dup.file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                  }

                  //was the misuse from the unconscious contribution?
                  if ((ret["internal_misuse"][dup.file] || []).some(function (item){return item.state === sta && item.representation === "q"+repi;}).length){
                    if (!ret["whole_deception_"+sit+"_fromSelf"][dup.file]){
                      ret["whole_deception_"+sit+"_fromSelf"][dup.file] = {};
                    }
                    ret["whole_deception_"+sit+"_fromSelf"][dup.file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;

                    if (maybe_both){
                      if (!ret["whole_deception_"+sit+"_fromBoth"][dup.file]){
                        ret["whole_deception_"+sit+"_fromBoth"][dup.file] = {};
                      }
                      ret["whole_deception_"+sit+"_fromBoth"][dup.file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                    }
                  }
                  else if (maybe_neither){
                    if (!ret["whole_deception_"+sit+"_fromNeither"][dup.file]){
                      ret["whole_deception_"+sit+"_fromNeither"][dup.file] = {};
                    }
                    ret["whole_deception_"+sit+"_fromNeither"][dup.file][sta+"-q"+repi+"-"+msg+"-"+act] = 1;
                  }
                }
              }
            }
          }
        }
      }
    }

  });

  var counts = {};
  for (var stat in ret){
    counts[stat] = _.filter(Object.keys(ret[stat]), function (statline){return statline !== 0 && !_.isEmpty(statline);}).length;
  }

  return [counts,ret];
}