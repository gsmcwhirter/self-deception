var path = require("path")
  , args = require("optimist")
      .usage("$0 [--generator] [--parser] [--fake] --meta <types> --dir <results_dir> --pmin <p_min> --pmax <p_max> --pstep <p_step> --cmin <c_min> --cmax <c_max> --cstep <c_step> --omin <o_min> --omax <o_max> --ostep <o_step> --smin <s_min> --smax <s_max> --sstep <s_step>")
      .demand(["dir"])
      .alias({"dir": "d", "script": "s", "iterations": "i", "duplications": "N", "threads": "M", "generator": "g", "parser": "p", "meta":"m", "verbose": "v"})
      .default("pmin", 0.0)
      .default("pmax", 1.0)
      .default("pstep", 0.1)
      .default("cmin", 0.0)
      .default("cmax", 0.6)
      .default("cstep", 0.1)
      .default("omin", 0.75)
      .default("omax", 1.0)
      .default("ostep", 0.25)
      .default("smin", 0.0)
      .default("smax", 0.5)
      .default("sstep", 0.25)
      .boolean("generator")
      .boolean("parser")
      .boolean("verbose")
      .boolean("fake")
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
                , "generator": "Run the json_generator script"
                , "parser": "Run the json_parser script"
                , "meta": "comma-separated list of properties to include in the meta-analysis"
                })
      .argv
  , fs = require("fs")
  , cp = require("child_process")
  , csv = require("csv-write-stream")
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

if (args.sstep <= 0){
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

  for (var o = args.omin; o <= args.omax + 0.0000000000000003; o += args.ostep){
    if (o == 0.9999999999999999 || o > 1) o = 1;
    var ostr = ((o == 1 || o == 0.0) ? o + ".0" : Math.round10(o, -3) + "");

    for (var p = args.pmin; p <= args.pmax; p += args.pstep){
      if (p == 0.9999999999999999) p = 1;
      var pstr = ((p == 1 || p == 0.0) ? p + ".0" : Math.round10(p, -3) + "");

      for (var c = args.cmin; c <= args.cmax; c += args.cstep){
        if (c == 0.9999999999999999) c = 1;
        var cstr = ((c == 1 || c == 0.0) ? c + ".0" : Math.round10(c, -3) + "");

        var odir = path.join(args.dir, "s_" + sstr + "_o_" + ostr + ".results")
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
      case "ret":
        ind = 1;
        break;
    }

    if (ind !== -1){
      metatasks.push([ind, parts2[1], part]);
    }

  });
}

console.log(metatasks);

execNextTask();

function execNextTask(){
  var task = tasks.pop();

  if (!task){
    whenDone();
    return;
  }

  console.log("Running node %s in %s", task.args.join(" "), task.odir);

  var doMeta = function(){
    if (args.meta && task.parser){
      var mrdir = path.join(task.odir, task.resultfile);

      var results;
      try {
        results = fs.readFileSync(path.resolve(mrdir), {encoding: "utf8"});
        results = JSON.parse(results);
      } catch (e) {
        results = null;
      }

      if (results !== null){
        try {
          metatasks.forEach(function (mtask){
            if (mtask[1] === "*"){
              for (var mt1 in results[mtask[0]]){
                var mt2 = ((mtask[0] === 1) ? "data" : "counts") + "." + mt1;
                if (!metadata[mt2]){
                  metadata[mt2] = {};
                }

                metadata[mt2][mrdir] = results[mtask[0]][mt1];
              }
            }
            else if (mtask[1] === "[default]"){
              [ "all_mostly_true_rep"
              , "all_totally_true_rep"
              , "inspecting_s0"
              , "inspecting_s1"
              , "self_deception_s0"
              , "self_deception_s1"
              , "conscious_deception_s1"
              , "conscious_deception_s1_a3_correct"
              , "conscious_deception_s1_a3_correct_self"
              , "whole_deception_s1"
              , "whole_deception_s1_a3"
              , "whole_deception_s1_fromConscious"
              , "whole_deception_s1_fromSelf"
              , "whole_deception_s1_fromBoth"
              , "whole_deception_s1_fromNeither"].forEach(function (mt1){
                var mt2 = ((mtask[0] === 1) ? "data" : "counts") + "." + mt1;
                if (!metadata[mt2]){
                  metadata[mt2] = {};
                }

                metadata[mt2][mrdir] = results[mtask[0]][mt1];
              });
            }
            else {
              if (!metadata[mtask[2]]){
                metadata[mtask[2]] = {};
              }

              metadata[mtask[2]][mrdir] = results[mtask[0]][mtask[1]];
            }
          });
        }
        catch (e){
          console.error(e);
        }
      }
    }
  };

  if (args.fake){
    doMeta();
    //process.nextTick(execNextTask);
    setImmediate(execNextTask);
    return;
  }

  cp.execFile("node", task.args, {
    cwd: path.resolve(task.odir)
  }, function (err, stdout, stderr){
    if (err){
      console.log(stdout);
      console.log(stderr);
    }
    else {
      if (args.verbose){
        console.log(stdout);
      }

      doMeta();
    }

    //process.nextTick(execNextTask);
    setImmediate(execNextTask);

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

    var csvHeaders = ["o","p","c"];
    var csvHeaders2 = ["s","p","c"];

    function parseFilenameParams(str){
      var ret = {s: null, p: null, c: null, o: null};
      var matches = str.match(/s_(\d*\.\d*).*o_(\d*\.\d*).*p_(\d*\.\d*).*c_(\d*\.\d*)/i);

      if (matches && matches.length){
        ret.s = matches[1];
        ret.o = matches[2];
        ret.p = matches[3];
        ret.c = matches[4];
      }

      return ret;
    }

    var csvData = {};
    var csvData2 = {};

    var seen_s_values;
    var seen_o_values;
    var mparams;
    for (var mkey in metadata){
      seen_s_values = [];
      seen_o_values = [];

      for (var fkey in metadata[mkey]){
        mparams = parseFilenameParams(fkey);
        if (!csvData[mparams.o+"-"+mparams.p+"-"+mparams.c]){
          csvData[mparams.o+"-"+mparams.p+"-"+mparams.c] = {
            o: mparams.o
          , p: mparams.p
          , c: mparams.c
          };
        }

        if (!csvData2[mparams.s+"-"+mparams.p+"-"+mparams.c]){
          csvData2[mparams.s+"-"+mparams.p+"-"+mparams.c] = {
            s: mparams.s
          , p: mparams.p
          , c: mparams.c
          };
        }

        if (seen_s_values.indexOf(mparams.s) === -1){
          seen_s_values.push(mparams.s);
          csvHeaders.push(mkey+" (s="+mparams.s+")");
        }

        if (seen_o_values.indexOf(mparams.o) === -1){
          seen_o_values.push(mparams.o);
          csvHeaders2.push(mkey+" (o="+mparams.o+")");
        }

        csvData[mparams.o+"-"+mparams.p+"-"+mparams.c][mkey+" (s="+mparams.s+")"] = metadata[mkey][fkey];
        csvData2[mparams.s+"-"+mparams.p+"-"+mparams.c][mkey+" (o="+mparams.o+")"] = metadata[mkey][fkey];
      }
    }

    var csvWriter = csv({headers: csvHeaders});
    csvWriter.pipe(fs.createWriteStream(path.resolve(path.join(args.dir, "metaresults_opc.csv"))));

    Object.keys(csvData).forEach(function (rowkey){
      csvWriter.write(csvData[rowkey]);
    });

    csvWriter.end();

    var csvWriter2 = csv({headers: csvHeaders2});
    csvWriter2.pipe(fs.createWriteStream(path.resolve(path.join(args.dir, "metaresults_spc.csv"))));

    Object.keys(csvData2).forEach(function (rowkey){
      csvWriter2.write(csvData2[rowkey]);
    });

    csvWriter2.end();
  }
}
