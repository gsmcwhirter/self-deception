var lib = require("./stats_lib")
  ;

console.log(lib.strategyToMaps(8));
console.log(lib.strategyToMaps(32));
console.log(lib.strategyToMaps(35));

console.log();

var pop1 = [
	{strategy: 33, proportion: 0.5}
, {strategy: 34, proportion: 0.5}
];
console.log(pop1);
var mgivenq1 = lib.generateMgivenQ(pop1);
console.log(mgivenq1);

var pop2 = [
	{strategy: 33, proportion: 0.6}
, {strategy: 34, proportion: 0.4}
];
console.log(pop2);
var mgivenq2 = lib.generateMgivenQ(pop2);
console.log(mgivenq2);

var pop3 = lib.strategyToStratdata(0);
console.log(pop3);
var mgivenq3 = lib.generateMgivenQ(pop3);
console.log(mgivenq3);

var pop4 = [
	{strategy: 32, proportion: 0.25}
, {strategy: 34, proportion: 0.5}
, {strategy: 35, proportion: 0.25}
];
console.log(pop4);
var mgivenq4 = lib.generateMgivenQ(pop4);
console.log(mgivenq4);

console.log();

console.log(lib.generateQgivenM(mgivenq1));
console.log(lib.generateQgivenM(mgivenq2));
console.log(lib.generateQgivenM(mgivenq3));

console.log();

console.log(lib.misuseAgainstPop('m0', 'q0', 33, pop1));
console.log(lib.misuseAgainstPop('m1', 'q0', 33, pop1));
console.log(lib.misuseAgainstPop('m0', 'q1', 33, pop1));
console.log(lib.misuseAgainstPop('m1', 'q1', 33, pop1));
console.log();
console.log(lib.misuseAgainstPop('m0', 'q0', 34, pop1));
console.log(lib.misuseAgainstPop('m1', 'q0', 34, pop1));
console.log(lib.misuseAgainstPop('m0', 'q1', 34, pop1));
console.log(lib.misuseAgainstPop('m1', 'q1', 34, pop1));

console.log();

console.log(lib.deceptionAgainstReceiver('m0', 'q0', 33, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q0', 33, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q1', 33, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q1', 33, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q0', 33, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q0', 33, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q1', 33, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q1', 33, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log();
console.log(lib.deceptionAgainstReceiver('m0', 'q0', 34, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q0', 34, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q1', 34, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q1', 34, 33, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q0', 34, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q0', 34, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m0', 'q1', 34, 34, pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.deceptionAgainstReceiver('m1', 'q1', 34, 34, pop1, lib.PAYOFF_SCHEMES[1]));

console.log();

console.log(lib.percentDeception(pop1, lib.PAYOFF_SCHEMES[1]));
console.log(lib.percentDeception(pop2, lib.PAYOFF_SCHEMES[1]));
console.log(lib.percentDeception(pop3, lib.PAYOFF_SCHEMES[1]));
console.log(lib.percentDeception(pop4, lib.PAYOFF_SCHEMES[1]));