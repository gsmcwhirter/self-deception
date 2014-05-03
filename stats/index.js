var path = require("path")
  , args = require("optimist")
      .usage("$0 [--generator] [--parser] --meta <types> --dir <results_dir> --pmin <p_min> --pmax <p_max> --pstep <p_step> --cmin <c_min> --cmax <c_max> --cstep <c_step> --omin <o_min> --omax <o_max> --ostep <o_step>")
      .demand(["dir"])
      .alias({"dir": "d", "script": "s", "iterations": "i", "duplications": "N", "threads": "M", "generator": "g", "parser": "p", "meta":"m"})
      .default("pmin", 0.0)
      .default("pmax", 1.0)
      .default("pstep", 0.1)
      .default("cmin", 0.0)
      .default("cmax", 0.6)
      .default("cstep", 0.1)
      .default("omin", 0.75)
      .default("omax", 1.0)
      .default("ostep", 0.25)
      .boolean("generator")
      .boolean("parser")
      .describe({ "dir": "The directory to output the results to."
                , "pmin": "The minimum p value (inclusive)."
                , "pmax": "The maximum p value."
                , "pstep": "The step between generated p values."
                , "cmin": "The minimum c value (inclusive)."
                , "cmax": "The maximum c value."
                , "cstep": "The step between generated c values."
                , "omin": "The minimum o value (inclusive)."
                , "omax": "The maximum o value."
                , "ostep": "The step between generated o values."
                , "generator": "Run the json_generator script"
                , "parser": "Run the json_parser script"
                , "meta": "comma-separated list of properties to include in the meta-analysis"
                })
      .argv
  , fs = require("fs")
  , cp = require("child_process")
  , script_path = ""
  , tasks = []
  , metadata = {}
  , metatasks = []
  ;      

require("buffertools"); //monkey-patch

fs.statSync(args.dir).isDirectory()

script_path = path.resolve(__dirname);

if (args.pstep <= 0){
  throw new Error("pstep cannot be non-positive.");
}

if (args.cstep <= 0){
  throw new Error("cstep cannot be non-positive.");
}

if (args.ostep <= 0){
  throw new Error("ostep cannot be non-positive.");
}

// from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
(function(){

  /**
   * Decimal adjustment of a number.
   *
   * @param {String}  type  The type of adjustment.
   * @param {Number}  value The number.
   * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
   * @returns {Number}      The adjusted value.
   */
  function decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

  // Decimal round
  if (!Math.round10) {
    Math.round10 = function(value, exp) {
      return decimalAdjust('round', value, exp);
    };
  }
  // Decimal floor
  if (!Math.floor10) {
    Math.floor10 = function(value, exp) {
      return decimalAdjust('floor', value, exp);
    };
  }
  // Decimal ceil
  if (!Math.ceil10) {
    Math.ceil10 = function(value, exp) {
      return decimalAdjust('ceil', value, exp);
    };
  }

})();

//Set up tasks
for (var o = args.omin; o <= args.omax; o += args.ostep){
  if (o == 0.9999999999999999) o = 1;
  var ostr = ((o == 1 || o == 0.0) ? o + ".0" : Math.round10(o, -3) + "");

  for (var p = args.pmin; p <= args.pmax; p += args.pstep){
    if (p == 0.9999999999999999) p = 1;
    var pstr = ((p == 1 || p == 0.0) ? p + ".0" : Math.round10(p, -3) + "");

    for (var c = args.cmin; c <= args.cmax; c += args.cstep){  
      if (c == 0.9999999999999999) c = 1;
      var cstr = ((c == 1 || c == 0.0) ? c + ".0" : Math.round10(c, -3) + "");

      var odir = path.join(args.dir, "o_" + ostr + ".results")
        , basename = "p_" + pstr + "_c_" + cstr
        ;

      if (args.parser){
        tasks.push({
          args: [path.resolve(path.join(__dirname,"json_parser.js")), "-s", basename + ".raw.json", "-o", basename + ".stats.json"]
        , odir: odir
        , parser: true
        , resultfile: basename + ".stats.json"
        });
      }

      if (args.generator){
        tasks.push({
          args: [path.resolve(path.join(__dirname,"json_generator.js")), "-o", basename + ".raw.json", "-d", basename + ".dir"]
        , odir: odir
        , parser: false
        });
      }
    }
  }
}

//console.log(tasks);

if (args.meta){
  var parts1 = args.meta.split(",");
  parts1.forEach(function (part){
    var parts2 = part.split(".");

    var ind = -1;
    switch (parts2[0]){
      case "counts":
        ind = 0;
        break;
      case "data":
        ind = 1;
        break;
    }

    if (ind !== -1){
      metatasks.push([ind, parts2[1], part]);  
    }
    
  });
}

execNextTask();

function execNextTask(){
  var task = tasks.pop();

  if (!task){
    whenDone();
    return;
  } 

  console.log("Running node %s in %s", task.args.join(" "), task.odir);
 
  cp.execFile("node", task.args, {
    cwd: path.resolve(task.odir)
  }, function (err, stdout, stderr){
    if (err){
      console.log(stdout);
      console.log(stderr);
    }
    else {
      if (args.meta && task.parser){
        var mrdir = path.join(task.odir, task.resultfile);
        var results = require(path.resolve(mrdir));

        try {
          metatasks.forEach(function (mtask){
            if (!metadata[mtask[2]]){
              metadata[mtask[2]] = {};
            }

            metadata[mtask[2]][mrdir] = results[mtask[0]][mtask[1]];
          });
        }
        catch (e){
          console.error(e);
        }
      }
    }

    process.nextTick(execNextTask);

    return;
  });
}

function whenDone(){
  if (args.meta && args.parser){
    var wstream = fs.createWriteStream(path.resolve(path.join(args.dir, "metaresults.json")));
    wstream.on("error", function (err){
      console.log("Write stream error:");
      console.log(err);
    });

    wstream.on("open", function (){
      wstream.end(JSON.stringify(metadata, null, 2), "utf8", function (){
        console.log("Meta-Stats written successfully.");
      });
    });
  }
}
