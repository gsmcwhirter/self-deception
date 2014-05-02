var args = require("optimist")
      .usage("$0 --stats <statsfile> --out <outfile>")
      .demand(["out", "stats"])
      .alias({"out": "o", "stats": "s"})
      .describe({ "out": "The file to output with data."
                , "stats": "The stats file to parse."})
      .argv
  , fs = require("fs")
  , path = require("path")
  , lib = require("./stats_lib")
  , _ = require("underscore")
  ;

var data = require(path.resolve(args.stats));
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

function parseStats(data){
  var states = 3
    , messages = 3
    , actions = 4
    , situations = 2
    ;

  /* // old style

  var ret = {
      mixedUC: {}
    , reallyMixedUC: {}
    , halfCheckS0: {}
    , halfCheckS1: {}
    , someCheckS0: {}
    , someCheckS1: {}
    , noCheckS0: {}
    , noCheckS1: {}
    }
  ;

  data.forEach(function (dup){
    if (!dup) return;

    var key;

    //Check unconscious sender first
    for (key in dup.data.UCMap){
      //Mixed?
      if (Object.keys(dup.data.UCMap[key]).length > 1){
        ret.mixedUC[dup.file] = (ret.mixedUC[dup.file] || 0) + 1;

        //Well-mixed?
        var all_big = _.all(Object.keys(dup.data.UCMap[key]), function (k){
          return dup.data.UCMap[key][k] >= 0.1;
        });

        if (all_big){
          ret.reallyMixedUC[dup.file] = (ret.reallyMixedUC[dup.file] || 0) + 1;
        }
      }
    }

    //Check receiver
    for (key in dup.data.RMap){
      //Do they check for deception in Situation 0?
      if (dup.data.RMap[key].s0.a3){
        //Yes, but how often?
        if (dup.data.RMap[key].s0.a3 >= 0.5){
          ret.halfCheckS0[dup.file] = (ret.halfCheckS0[dup.file] || 0) + 1;
        }
        else {
          ret.someCheckS0[dup.file] = (ret.someCheckS0[dup.file] || 0) + 1;
        }
      }
      else {
        //No, they don't check
        ret.noCheckS0[dup.file] = (ret.noCheckS0[dup.file] || 0) + 1;
      }

      //Do they check for deception in Situation 1?
      if (dup.data.RMap[key].s1.a3){
        if (dup.data.RMap[key].s1.a3 >= 0.5){
          ret.halfCheckS1[dup.file] = (ret.halfCheckS1[dup.file] || 0) + 1;
        }
        else {
          ret.someCheckS1[dup.file] = (ret.someCheckS1[dup.file] || 0) + 1;
        }
      }
      else {
        ret.noCheckS1[dup.file] = (ret.noCheckS1[dup.file] || 0) + 1;
      }
    }
  });

  var counts = {};
  for (var stat in ret){
    counts[stat] = Object.keys(ret[stat]).length;
  }

  return [ret, counts];
  */

  var ret = {
    mostly_true_rep: {}
  , totally_true_rep: {}
  , all_mostly_true_rep: {}
  , all_totally_true_rep: {}
  , not_totally_true_rep: {}
  , not_mostly_true_rep: {}
  , inspecting_s0: {}
  , inspecting_s1: {}
  };

  data.forEach(function (dup){
    if (!dup){
      console.error("No duplication object.");
      return;
    }

    var key;

    for (key in dup.data.UMap){
      //is the state represented correctly at least 40% of the time?
      if (dup.data.UMap[key][key] && dup.data.UMap[key][key] >= 0.4){
        if (!ret.mostly_true_rep[dup.file]){
          ret.mostly_true_rep[dup.file] = [];
        }

        ret.mostly_true_rep[dup.file].push(key);

        //Is this the case in every state of the world?
        if (ret.mostly_true_rep[dup.file].length === states){
          ret.all_mostly_true_rep[dup.file] = true;
        }
      }

      //is the state represented correctly all of the time?
      if (dup.data.UMap[key][key] && (Object.keys(dup.data.UMap[key]).length === 1 || dup.data.UMap[key][key] > 0.99)){
        if (!ret.totally_true_rep[dup.file]){
          ret.totally_true_rep[dup.file] = [];
        }

        ret.totally_true_rep[dup.file].push(key);

        //Is this the case in every state of the world?
        if (ret.totally_true_rep[dup.file].length === states){
          ret.all_totally_true_rep[dup.file] = true;
        }
      }
    }

    for (key in dup.data.RMap){
      //given key message, does the receiver inspect a fair bit?
      if (dup.data.RMap[key]['s0']['a3'] && dup.data.RMap[key]['s0']['a3'] > 0.01){
        if (!ret.inspecting_s0[dup.file]){
          ret.inspecting_s0[dup.file] = [];
        }

        ret.inspecting_s0[dup.file].push([key, dup.data.RMap[key]['s0']['a3']])
      }

      if (dup.data.RMap[key]['s1']['a3'] && dup.data.RMap[key]['s1']['a3'] > 0.01){
        if (!ret.inspecting_s1[dup.file]){
          ret.inspecting_s1[dup.file] = [];
        }

        ret.inspecting_s1[dup.file].push([key, dup.data.RMap[key]['s1']['a3']])
      }
    }

    if (!ret.all_mostly_true_rep[dup.file]){
      ret.not_mostly_true_rep[dup.file] = ret.mostly_true_rep[dup.file] || [];
    }

    if (!ret.all_totally_true_rep[dup.file]){
      ret.not_totally_true_rep[dup.file] = ret.totally_true_rep[dup.file] || [];
    }
  });

  var counts = {};
  for (var stat in ret){
    counts[stat] = Object.keys(ret[stat]).length;
  }

  return [counts,ret];
}