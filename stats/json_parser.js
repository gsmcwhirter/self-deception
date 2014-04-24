var args = require("optimist")
      .usage("$0 --stats <statsfile> --out <outfile>")
      .demand(["out", "stats"])
      .alias({"out": "o", "stats": "s"})
      .describe({ "out": "The file to output with data."
                , "stats": "The stats file to parse."})
      .argv
  , fs = require("fs")
  , path = require("path")
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
}