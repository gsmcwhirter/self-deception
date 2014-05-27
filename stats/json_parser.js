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
  , other_misuse_s0: {} //External misuse? (loop)
  , other_misuse_s1: {} //External misuse? (loop)
  , other_deception_s0: {}
  , other_deception_s1: {}
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

  data.forEach(function (dup){
    if (!dup){
      console.error("No duplication object.");
      return;
    }

    var key;

    for (key in dup.data.UMap){
      //Mostly true rep? is the state represented correctly at least 40% of the time?
      if (dup.data.UMap[key][key] && dup.data.UMap[key][key] >= 0.4){
        if (!ret.mostly_true_rep[dup.file]){
          ret.mostly_true_rep[dup.file] = [];
        }

        ret.mostly_true_rep[dup.file].push(key);

        //All mostly true rep? Is this the case in every state of the world?
        if (ret.mostly_true_rep[dup.file].length === states){
          ret.all_mostly_true_rep[dup.file] = true;
        }
      }

      //Totally true rep? is the state represented correctly all of the time?
      if (dup.data.UMap[key][key] && (Object.keys(dup.data.UMap[key]).length === 1 || dup.data.UMap[key][key] > 0.995)){
        if (!ret.totally_true_rep[dup.file]){
          ret.totally_true_rep[dup.file] = [];
        }

        ret.totally_true_rep[dup.file].push(key);

        //All totally true rep? Is this the case in every state of the world?
        if (ret.totally_true_rep[dup.file].length === states){
          ret.all_totally_true_rep[dup.file] = true;
        }
      }

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
        if (!ret.mixed_strat_s0[dup.file]){
          ret.mixed_strat_s0[dup.file] = [];
        }

        ret.mixed_strat_s0[dup.file].push(key);
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
    for (var st in dup.data.UMap){
      for (var r in dup.data.UMap[st]){
        pure_sender_strats.forEach(function (sender_data){
          if (internal_analyzer.misuse(sender_data, dup.data.UMap, r, st)){
            if (!ret.internal_misuse[dup.file]){
              ret.internal_misuse[dup.file] = []
            }

            ret.internal_misuse[dup.file].push({sender_strat: sender_data, state: st, representation: r, probability: dup.data.UMap[st][r]});

            //Self-Deception? there is misuse -- check for self-deception
            var sit_dec_data = sd_analyzer.deceptionOnMessagesAndSituations(r, st, dup.data.UMap, dup.data.CMap);
            if (Object.keys(sit_dec_data).length > 0){
              for (var sitkey in sit_dec_data){
                ret["self_deception_"+sitkey][dup.file] = {state: st, representation: r, messages: sit_dec_data[sitkey]};
              }
            }
          }
        });
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
    var external_analyzer = new sl.InformationAnalyzer(states, messages, rep_probs, {state: 'q', message: 'm'});
    var dec_analyzer = new sl.ExtDeceptionAnalyzer(states, messages, actions, situations, params.c, base_payoffs, dup.data.RMap);
    for (siti = 0; siti < situations; siti++){
      sit = 's'+siti;
      var pure_sender_strats = external_analyzer.generatePureSenderStrategies(dup.data.CMap[sit]);

      for (var rep in dup.data.CMap[sit]){
        for (var msg in dup.data.CMap[sit][rep]){
          pure_sender_strats.forEach(function (sender_data){
            if (external_analyzer.misuse(sender_data, dup.data.CMap[sit], msg, rep)){
              if (!ret["other_misuse_"+sit][dup.file]){
                ret["other_misuse_"+sit][dup.file] = []
              }

              ret["other_misuse_"+sit][dup.file].push({sender_strat: sender_data, representation: rep, message: msg, probability: dup.data.CMap[sit][rep][msg]});

              //External deception? there is misuse -- check for deception
              for (stai = 0; stai < states; stai++){
                st = 'q'+stai;
                //that representation is used in that state
                if (dup.data.UMap[st][rep] > 0.0){
                  var dec_data = dec_analyzer.deception(msg, st, sit, dup.data.CMap, dup.data.RMap);
                  if (Object.keys(dec_data).length > 0){
                    for (var sitkey in dec_data){
                      if (!ret["other_deception_"+sitkey][dup.file]){
                        ret["other_deception_"+sitkey][dup.file] = [];
                      }
                      ret["other_deception_"+sitkey][dup.file].push({state: st, representation: r, message: msg, data: dec_data[sit]})
                    }
                  }
                }
              }
            }
          });
        }
      }
    }
    
  });

  var counts = {};
  for (var stat in ret){
    counts[stat] = Object.keys(ret[stat]).length;
  }

  return [counts,ret];
}