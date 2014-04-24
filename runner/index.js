var path = require("path")
  , args = require("optimist")
      .usage("$0 --script <script> --dir <results_dir> --zip --pmin <p_min> --pmax <p_max> --pstep <p_step> --cmin <c_min> --cmax <c_max> --cstep <c_step> --omin <o_min> --omax <o_max> --ostep <o_step> --iterations <iters> --duplications <dups> --threads <thr>")
      .demand(["dir"])
      .alias({"dir": "d", "zip": "z", "script": "s", "iterations": "i", "duplications": "N", "threads": "M"})
      .default("script", path.resolve(path.join(__dirname, "..", "build", "urnlearning_sim")))
      .default("pmin", 0.0)
      .default("pmax", 1.0)
      .default("pstep", 0.1)
      .default("cmin", 0.0)
      .default("cmax", 0.6)
      .default("cstep", 0.1)
      .default("omin", 0.5)
      .default("omax", 1.0)
      .default("ostep", 0.25)
      .default("iterations", 10000000)
      .default("duplications", 1000)
      .default("threads", 4)
      .boolean("zip")
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
                , "zip": "Zip the output directory after the run."})
      .argv
  , fs = require("fs")
  , events = require("events")
  , util = require("util")
  , cp = require("child_process")
  , tar = require("tar")
  , gzbz = require("gzbz/streaming")
  , library_path = ""
  , tasks = []
  ;      

require("buffertools"); //monkey-patch

try {
  if (!fs.statSync(args.dir).isDirectory()){
    fs.mkdirSync(args.dir);
  }
} catch (e) {
  fs.mkdirSync(args.dir);
}

try {
  if (!fs.statSync(args.script).isFile()){
    throw new Error("Cannot find script to run.");
  }
} catch (e) {
  throw new Error("Cannot find script to run.");
}

library_path = path.dirname(args.script);
args.library_path = library_path;

if (args.pstep <= 0){
  throw new Error("pstep cannot be non-positive.");
}

if (args.cstep <= 0){
  throw new Error("cstep cannot be non-positive.");
}

if (args.ostep <= 0){
  throw new Error("ostep cannot be non-positive.");
}

for (var o = args.omin; o <= args.omax; o += args.ostep){
  if (o == 0.9999999999999999) o = 1;

  for (var p = args.pmin; p <= args.pmax; p += args.pstep){
    if (p == 0.9999999999999999) p = 1;

    for (var c = args.cmin; c <= args.cmax; c += args.cstep){  
      if (c == 0.9999999999999999) c = 1;

      tasks.push({
        args: ["-f", "-v", "-i", args.iterations, "-N", args.duplications, "-M", args.threads, "-p", p, "-c", c, "-o", o]
      , o: o
      , p: p
      , c: c
      });
    }
  }
}

//console.log(tasks);

console.log("Script: %s", args.script);
console.log("Results: %s", path.resolve(args.dir));

execNextTask();

function execNextTask(){
  var task = tasks.pop();

  if (!task) return;

  console.log("Running %s", task.args.join(" "));

  var odir = path.join(args.dir, "o_" + ((task.o == 1 || task.o == 0.0) ? task.o + ".0" : Math.round10(task.o, -2)) + ".results")
    , basename = ((task.p == 1 || task.p == 0.0) ? task.p + ".0" : Math.round10(task.p, -1)) + "_c_" + ((task.c == 1 || task.c == 0.0) ? task.c + ".0" : Math.round10(task.c, -1))
    , pcdir = path.join(odir, "p_" + basename + ".dir")
    , logfile = path.join(odir, "p_" + basename + ".log")
    ;

  try {
    fs.mkdirSync(odir);
  }
  catch (e) {}

  try {
    if (fs.statSync(pcdir).isDirectory()){
      throw new Error("Output directory already exists.");
    }
  } catch (e) {
    if (e.message == "Output directory already exists."){
      throw e;
    }
    else {
      fs.mkdirSync(pcdir);
    }
  }
  
  cp.execFile(args.script, task.args, {
    cwd: pcdir
  , env: {
      "LD_LIBRARY_PATH": args.library_path
    , "DYLD_LIBRARY_PATH": args.library_path
    }
  }, function (err, stdout, stderr){
    if (err){
      fs.writeFileSync(logfile, err);
      fs.appendFileSync(logfile, stderr);
    }
    else {
      fs.writeFileSync(logfile, stdout);
    }

    execNextTask();
  });
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
