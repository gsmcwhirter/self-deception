var path = require("path")
  , args = require("optimist")
      .usage("$0 --script <script> --dir <results_dir> --pmin <p_min> --pmax <p_max> --pstep <p_step> --cmin <c_min> --cmax <c_max> --cstep <c_step> --omin <o_min> --omax <o_max> --ostep <o_step> --smin <s_min> --smax <s_max> --sstep <s_step> --iterations <iters> --duplications <dups> --threads <thr>")
      .demand(["dir"])
      .alias({"dir": "d", "script": "s", "iterations": "i", "duplications": "N", "threads": "M"})
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
      .default("smin", 0.0)
      .default("smax", 0.5)
      .default("sstep", 0.25)
      .default("iterations", 10000000)
      .default("duplications", 1000)
      .default("threads", 4)
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
                , "smin": "The minimum s value (inclusive)."
                , "smax": "The maximum s value."
                , "sstep": "The step between generated s values."
                })
      .argv
  , fs = require("fs")
  , cp = require("child_process")
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

if (args.sstep < 0){
  throw new Error("sstep cannot be non-positive.");
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
for (var s = args.smin; s <= args.smax; s += args.sstep){
  if (s == 0.9999999999999999) s = 1;
  var sstr = ((s == 1 || s == 0.0) ? s + ".0" : Math.round10(s, -3) + "");

  for (var o = args.omin; o <= args.omax; o += args.ostep){
    if (o == 0.9999999999999999) o = 1;
    var ostr = ((o == 1 || o == 0.0) ? o + ".0" : Math.round10(o, -3) + "");

    for (var p = args.pmin; p <= args.pmax; p += args.pstep){
      if (p == 0.9999999999999999) p = 1;
      var pstr = ((p == 1 || p == 0.0) ? p + ".0" : Math.round10(p, -3) + "");

      for (var c = args.cmin; c <= args.cmax; c += args.cstep){  
        if (c == 0.9999999999999999) c = 1;
        var cstr = ((c == 1 || c == 0.0) ? c + ".0" : Math.round10(c, -3) + "");


        tasks.push({
          args: ["-f", "-v", "-i", args.iterations, "-N", args.duplications, "-M", args.threads, "-p", pstr, "-c", cstr, "-o", ostr, "-s", sstr]
        , ostr: ostr
        , pstr: pstr
        , cstr: cstr
        , sstr: sstr
        });
      }
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

  var odir = path.join(args.dir, "s_" + task.sstr + "_o_" + task.ostr + ".results")
    , basename = "p_" + task.pstr + "_c_" + task.cstr
    , pcdir = path.join(odir, basename + ".dir")
    , logfile = path.join(odir, basename + ".log")
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

    process.nextTick(execNextTask);
    return;
  });
}
