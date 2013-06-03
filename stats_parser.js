var args = require("optimist")
      .usage("$0 --out [outfile] --dir [results_dir]")
      .demand(["out", "dir"])
      .alias({"out": "o", "dir": "d"})
      .describe({"out": "The file to output with statistics.", "dir": "The directory containing the .out files from a simulation run."})
      .check(checkArguments)
      .argv
  , fs = require("fs")
  ;      

require("buffertools") //monkey-patch

if (!fs.statSync(args.dir).isDirectory()){
  console.log("Error: dir is not a directory.");
}
else {
  fs.readdir(args.dir, function (err, files){
    if (err){
      console.log("Error reading the output directory.");
      return;
    }
    
    var numFiles = files.length;
    var doneFiles = 0;
    console.log("Opened the output directory.");
    
    files.forEach(function (file){
      console.log("Parsing %s...", file);
      var rstream = fs.createReadStream(file)
      
        , end_state_started = false
        , start_byte = 0
        , incomplete_line = ""
      
        , players = []
        , current_player = -1
        ;
      
      rstream.on("readable", function (){
        var buffer = rstream.read();
        //TODO: parse output
        
        if (end_state_started){
          start_byte = 0;
        }
        else if (buffer.toString().match(/^done.\s\n/g).length > 0) {
          end_state_started = true;
          start_byte = buffer.indexOf("done.\n");
        }
        
        if (end_state_started){
          var lines = buffer.toString('utf8', start_byte).split("\n");
          lines[0] = incomplete_line + lines[0];
          incomplete_line = lines.pop();
          
          lines.forEach(function (line){
            var matches;
            matches = line.match(/^\sPlayer (\d+)\s$/);
            if (matches.length){
              current_player = parseInt(matches[1], 10);
              players[current_player] = {counts: [], proportions: []};
              return;
            }
            
            matches = line.match(/^Counts: (.+)$/);
            if (matches.length){
              players[current_player].counts.push(matches[1].trim()
                                                            .split(/\s+/)
                                                            .map(function (prop){
                                                              return parseFloat(prop.trim());
                                                            }));
            }
            
            matches = line.match(/^\sProportions: (.+)$/);
            if (matches.length){
              players[current_player].proportions.push(matches[1].trim()
                                                                 .split(/\s+/)
                                                                 .map(function (prop){
                                                                   return parseFloat(prop.trim());
                                                                 }));
            }
          });
        }
      }); 
      
      rstream.on("end", function (){
        doneFiles += 1;
        
        console.log(players);
        
        whenDone();
      });
    });
    
    function whenDone(){
      if (doneFiles >= numFiles){
        //TODO: output stats
      }
    }
  });
}
