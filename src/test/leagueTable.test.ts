import { describe, it, expect } from "vitest";
import { parseLeagueTable, resolveName } from "@/lib/leagueTable";

// Week 7 table exactly as posted in the group.
const WEEK_7 = `  OCTOPUS LEAGUE WEEK 7 TABLE

  SN                       PP         NP         TP

  1.Gigalolu            105          19        124

  2.Bosco               101          20        121

  3.Fabulous         96          23       119

  4.God’s O            104         13         117

  5.Jules                93          23        116

  6.Prince                98          18       116

  7.FiskySo             97          17       114

  8.Rector            96            16       112

  9.KAYBEST           100          10       110

  10.DaSilva            88         06      94

  11.Ahmed jr         70         23       93

  12.Okesco           75          17       92

  13.Anony             81         10        91

  14.Cityzen           70         14       84

  15.Anyi                  58         15        73

  16.Azeez              49        22        71

  17.Olamii               57         10        67

  18.Danny              54        12        66

  19.MsBaba           63         ----       63

  20.Don Thiago    35         ----        35

  …………………………………………………

  Note correct score will be used when two managers finish on the same points

  *Correct Score update*


*God’s O*  09
*Jules* 08
*Ahmed jr*  05
*Azeez*  04
*Fabulous*  04
*FiskySo*   04
*Kaybest*   03
*Rector*   03
*Msbaba*   02
*Bosco*   02
*Gigalolu*   01
*Olamii*    01
Anonymous      01
Don Thiago :   01
  where PP = previous point
  NP = New point
  TP = Total points.`;

describe("parseLeagueTable", () => {
  it("reads every player's total and correct scores from the posted table", () => {
    const table = parseLeagueTable(WEEK_7)!;
    expect(table.week).toBe(7);
    expect(table.warnings).toEqual([]);
    expect(table.rows.map((r) => [r.whatsAppName, r.points, r.correctScores])).toEqual([
      ["Gigalolu", 124, 1],
      ["Bosco", 121, 2],
      ["Fabulous", 119, 4],
      ["God’s O", 117, 9],
      ["Jules", 116, 8],
      ["Prince", 116, 0],
      ["FiskySo", 114, 4],
      ["Rector", 112, 3],
      ["KAYBEST", 110, 3],
      ["DaSilva", 94, 0],
      ["Ahmed jr", 93, 5],
      ["Okesco", 92, 0],
      ["Anony", 91, 1],
      ["Cityzen", 84, 0],
      ["Anyi", 73, 0],
      ["Azeez", 71, 4],
      ["Olamii", 67, 1],
      ["Danny", 66, 0],
      ["MsBaba", 63, 2],
      ["Don Thiago", 35, 1],
    ]);
  });

  it("reads a correct-score list without asterisks or leading zeros", () => {
    const table = parseLeagueTable(
      "1.God’s O  104  13  117\n\n2.Anony  81  10  91\n\n" +
        "Note correct score will be used when two managers finish on the same points\n\n" +
        "Correct Score Update\n\nGod’s O 9\n Anonymous 1\n",
    )!;
    expect(table.warnings).toEqual([]);
    expect(table.rows.map((r) => [r.whatsAppName, r.points, r.correctScores])).toEqual([
      ["God’s O", 117, 9],
      ["Anony", 91, 1],
    ]);
  });

  it("warns about correct scores for names not in the table", () => {
    const table = parseLeagueTable("1.Bosco 10 2 12\n2.Jules 5 5 10\nCorrect scores\n*Stranger* 03\n")!;
    expect(table.warnings).toEqual(['Correct scores for "Stranger" (3) match no player in the table.']);
  });

  it("does not treat a CSV as a league table", () => {
    expect(parseLeagueTable("whatsapp,points\nBosco,121\nJules,116\n")).toBeNull();
  });
});

describe("resolveName", () => {
  it("prefers an exact match, then a unique prefix of 4+ characters", () => {
    expect(resolveName("Anonymous", ["Anony", "Anyi"])).toBe(0);
    expect(resolveName("God's O", ["God’s own"])).toBe(0);
    expect(resolveName("Ahmed", ["Ahmed", "Ahmed jr"])).toBe(0);
    expect(resolveName("Ahm", ["Ahmed jr"])).toBeNull();
    expect(resolveName("Dan", ["Danny", "Daniel"])).toBeNull();
  });
});
