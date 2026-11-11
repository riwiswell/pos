export type BibleReadingDay = {
  day: number;
  month: string;
  dayOfMonth: number;
  readings: [string, string, string];
};

const MONTHS: Array<{ name: string; rows: string }> = [
  { name: "Enero", rows: `
Lc 5.27-39~Gn 1—2~Sal 1
Lc 6.1-26~Gn 3—5~Sal 2
Lc 6.27-49~Gn 6—7~Sal 3
Lc 1.1-17~Gn 8—10~Sal 4
Lc 7.18-50~Gn 11~Sal 5
Lc 8.1-25~Gn 12~Sal 6
Lc 8.26-56~Gn 13—14~Sal 7
Lc 9.1-27~Gn 15~Sal 8
Lc 9.28-62~Gn 16~Sal 9
Lc 10.1-20~Gn 17~Sal 10
Lc 10.21-42~Gn 18~Sal 11
Lc 11.1-28~Gn 19~Sal 12
Lc 11.29-54~Gn 20~Sal 13
Lc 12.1-31~Gn 21~Sal 14
Lc 12.32-59~Gn 22~Sal 15
Lc 13.1-17~Gn 23~Sal 16
Lc 13.18-35~Gn 24~Sal 17
Lc 14.1-24~Gn 25~Sal 18
Lc 14.25-35~Gn 26~Sal 19
Lc 15~Gn 27.1-45~Sal 20
Lc 16~Gn 27.46—28.22~Sal 21
Lc 17~Gn 29.1-30~Sal 22
Lc 18.1-17~Gn 29.31—30.43~Sal 23
Lc 18.18-43~Gn 31~Sal 24
Lc 19.1-27~Gn 32—33~Sal 25
Lc 19.28-48~Gn 34~Sal 26
Lc 20.1-26~Gn 35—36~Sal 27
Lc 20.27-47~Gn 37~Sal 28
Lc 21~Gn 38~Sal 29
Lc 22.1-38~Gn 39~Sal 30
Lc 22.39-71~Gn 40~Sal 31
` },
  { name: "Febrero", rows: `
Lc 23.1-25~Gn 41~Sal 32
Lc 23.26-56~Gn 42~Sal 33
Lc 24.1-12~Gn 43~Sal 34
Lc 24.13-53~Gn 44~Sal 35
He 1~Gn 45.1—46.27~Sal 36
He 2~Gn 46.28—47.31~Sal 37
He 3.1—4.13~Gn 48~Sal 38
He 4.14—6.12~Gn 49—50~Sal 39
He 6.13-20~Ex 1—2~Sal 40
He 7~Ex 3—4~Sal 41
He 8~Ex 5.1—6.27~Pr 1
He 9.1-22~Ex 6.28—8.32~Pr 2
He 9.23—10.18~Ex 9—10~Pr 3
He 10.19-39~Ex 11—12~Pr 4
He 11.1-21~Ex 13—14~Pr 5
He 11.22-40~Ex 15~Pr 6.1—7.5
He 12~Ex 16—17~Pr 7.6-27
He 13~Ex 18—19~Pr 8
Mt 1~Ex 20—21~Pr 9
Mt 2~Ex 22—23~Pr 10
Mt 3~Ex 24~Pr 11
Mt 4~Ex 25—27~Pr 12
Mt 5.1-20~Ex 28—29~Pr 13
Mt 5.21-48~Ex 30—32~Pr 14
Mt 6.1-18~Ex 33—34~Pr 15
Mt 6.19-34~Ex 35—36~Pr 16
Mt 7~Ex 37—38~Pr 17
Mt 8.1-13~Ex 39—40~Pr 18
` },
  { name: "Marzo", rows: `
Mt 8.14-34~Lv 1—2~Pr 19
Mt 9.1-17~Lv 3—4~Pr 20
Mt 9.18-38~Lv 5—6~Pr 21
Mt 10.1-25~Lv 7—8~Pr 22
Mt 10.26-42~Lv 9—10~Pr 23
Mt 11.1-19~Lv 11—12~Pr 24
Mt 11.20-30~Lv 13~Pr 25
Mt 12.1-21~Lv 14~Pr 26
Mt 12.22-50~Lv 15—16~Pr 27
Mt 13.1-23~Lv 17—18~Pr 28
Mt 13.24-58~Lv 19~Pr 29
Mt 14.1-21~Lv 20—21~Pr 30
Mt 14.22-36~Lv 22—23~Pr 31
Mt 15.1-20~Lv 24—25~Ec 1.1-11
Mt 15.21-39~Lv 26—27~Ec 1.12—2.26
Mt 16~Nm 1—2~Ec 3.1-15
Mt 17~Nm 3—4~Ec 3.16—4.16
Mt 18.1-17~Nm 5—6~Ec 5
Mt 18.18-35~Nm 7—8~Ec 6
Mt 19.1-15~Nm 9—10~Ec 7
Mt 19.16-30~Nm 11—12~Ec 8
Mt 20.1-16~Nm 13—14~Ec 9.1-12
Mt 20.17-34~Nm 15—16~Ec 9.13—10.20
Mt 21.1-27~Nm 17—18~Ec 11.1-8
Mt 21.28-46~Nm 19—20~Ec 11.9—12.14
Mt 22.1-22~Nm 21~Cnt 1.1—2.7
Mt 22.23-46~Nm 22.1-40~Cnt 2.8—3.5
Mt 23.1-12~Nm 22.41—23.26~Cnt 3.6—5.1
Mt 23.13-39~Nm 23.27—24.25~Cnt 5.2—6.3
Mt 24.1-31~Nm 25—27~Cnt 6.4—8.4
Mt 24.32-51~Nm 28—29~Cnt 8.5-14
` },
  { name: "Abril", rows: `
Mt 25.1-30~Nm 30—31~Job 1
Mt 25.31-46~Nm 32—34~Job 2
Mt 26.1-25~Nm 35—36~Job 3
Mt 26.26-46~Dt 1—2~Job 4
Mt 26.47-75~Dt 3—4~Job 5
Mt 27.1-31~Dt 5—6~Job 6
Mt 27.32-66~Dt 7—8~Job 7
Mt 28~Dt 9—10~Job 8
Hch 1~Dt 11—12~Job 9
Hch 2.1-13~Dt 13—14~Job 10
Hch 2.14-47~Dt 15—16~Job 11
Hch 3~Dt 17—18~Job 12
Hch 4.1-22~Dt 19—20~Job 13
Hch 4.23-37~Dt 21—22~Job 14
Hch 5.1-16~Dt 23—24~Job 15
Hch 5.17-42~Dt 25—27~Job 16
Hch 6~Dt 28~Job 17
Hch 7.1-22~Dt 29—30~Job 18
Hch 7.23—8.1~Dt 31—32~Job 19
Hch 8.1-25~Dt 33—34~Job 20
Hch 8.26-40~Jos 1—2~Job 21
Hch 9.1-25~Jos 3.1—5.1~Job 22
Hch 9.26-43~Jos 5.2—6.27~Job 23
Hch 10.1-33~Jos 7—8~Job 24
Hch 10.34-48~Jos 9—10~Job 25
Hch 11.1-18~Jos 11—12~Job 26
Hch 11.19-30~Jos 13—14~Job 27
Hch 12~Jos 15—17~Job 28
Hch 13.1-25~Jos 18—19~Job 29
Hch 13.26-52~Jos 20—21~Job 30
` },
  { name: "Mayo", rows: `
Hch 14~Jos 22~Job 31
Hch 15.1-21~Jos 23—24~Job 32
Hch 15.22-41~Jue 1~Job 33
Hch 16.1-15~Jue 2—3~Job 34
Hch 16.16-40~Jue 4—5~Job 35
Hch 17.1-15~Jue 6~Job 36
Hch 17.16-34~Jue 7—8~Job 37
Hch 18~Jue 9~Job 38
Hch 19.1-20~Jue 10.1—11.33~Job 39
Hch 19.21-41~Jue 11.34—12.15~Job 40
Hch 20.1-16~Jue 13~Job 41
Hch 20.17-38~Jue 14—15~Job 42
Hch 21.1-36~Jue 16~Sal 42
Hch 21.37—22.29~Jue 17—18~Sal 43
Hch 22.30—23.22~Jue 19~Sal 44
Hch 23.23—24.9~Jue 20~Sal 45
Hch 24.10-27~Jue 21~Sal 46
Hch 25~Rt 1—2~Sal 47
Hch 26.1-18~Rt 3—4~Sal 48
Hch 26.19-32~1 S 1.1—2.11~Sal 49
Hch 27.1-12~1 S 2.12—2.36~Sal 50
Hch 27.13-44~1 S 3~Sal 51
Hch 28.1-15~1 S 4—5~Sal 52
Hch 28.16-31~1 S 6—7~Sal 53
Ro 1.1-15~1 S 8~Sal 54
Ro 1.16-32~1 S 9.1—10.16~Sal 55
Ro 2.1-3.8~1 S 10.17—11.15~Sal 56
Ro 3.9-31~1 S 12~Sal 57
Ro 4~1 S 13~Sal 58
Ro 5~1 S 14~Sal 59
Ro 6~1 S 15~Sal 60
` },
  { name: "Junio", rows: `
Ro 7~1 S 16~Sal 61
Ro 8~1 S 17.1-54~Sal 62
Ro 9.1-29~1 S 17.55—18.30~Sal 63
Ro 9.30—10.21~1 S 19~Sal 64
Ro 11.1-24~1 S 20~Sal 65
Ro 11.25-36~1 S 21—22~Sal 66
Ro 12~1 S 23—24~Sal 67
Ro 13~1 S 25~Sal 68
Ro 14~1 S 26~Sal 69
Ro 15.1-13~1 S 27—28~Sal 70
Ro 15.14-33~1 S 29—31~Sal 71
Ro 16~2 S 1~Sal 72
Mr 1.1-20~2 S 2.1—3.1~Dan 1
Mr 1.21-45~2 S 3.2-39~Dan 2.1-23
Mr 2~2 S 4—5~Dan 2.24-49
Mr 3.1-19~2 S 6~Dan 3
Mr 3.20-35~2 S 7—8~Dan 4
Mr 4.1-20~2 S 9—10~Dan 5
Mr 4.21-41~2 S 11—12~Dan 6
Mr 5.1-20~2 S 13~Dan 7
Mr 5.21-43~2 S 14~Dan 8
Mr 6.1-29~2 S 15~Dan 9
Mr 6.30-56~2 S 16~Dan 10.1—11.2
Mr 7.1-13~2 S 17~Dan 11.2-20
Mr 7.14-37~2 S 18~Dan 11.21-45
Mr 8.1-21~2 S 19~Dan 12
Mr 8.22—9.1~2 S 20—21~Os 1.1—2.1
Mr 9.2-50~2 S 22~Os 2.2-23
Mr 10.1-31~2 S 23~Os 3
Mr 10.32-52~2 S 24~Os 4.1-10
` },
  { name: "Julio", rows: `
Mr 11.1-14~1 R 1~Os 4.11—5.3
Mr 11.15-33~1 R 2~Os 5.4-15
Mr 12.1-27~1 R 3~Os 6.1—7.2
Mr 12.28-44~1 R 4—5~Os 7.3-16
Mr 13.1-13~1 R 6~Os 8
Mr 13.14-37~1 R 7~Os 9.1-16
Mr 14.1-31~1 R 8~Os 9.17—10.15
Mr 14.32-72~1 R 9~Os 11.1-11
Mr 15.1-20~1 R 10~Os 11.12—12.14
Mr 15.21-47~1 R 11~Os 13
Mr 16~1 R 12.1-31~Os 14
1 Co 1.1-17~1 R 12.32—13.34~Jl 1
1 Co 1.18-31~1 R 14~Jl 2.1-11
1 Co 2~1 R 15.1-32~Jl 2.12-32
1 Co 3~1 R 15.33—16.34~Jl 3
1 Co 4~1 R 17~Am 1
1 Co 5~1 R 18~Am 2.1—3.2
1 Co 6~1 R 19~Am 3.3—4.3
1 Co 7.1-24~1 R 20~Am 4.4-13
1 Co 7.25-40~1 R 21~Am 5
1 Co 8~1 R 22~Am 6
1 Co 9~2 R 1—2~Am 7
1 Co 10~2 R 3~Am 8
1 Co 11.1-16~2 R 4~Am 9
1 Co 11.17-34~2 R 5~Abd
1 Co 12~2 R 6.1—7.2~Jon 1
1 Co 13~2 R 7.3-20~Jon 2
1 Co 14.1-25~2 R 8~Jon 3
1 Co 14.26-40~2 R 9~Jon 4
1 Co 15.1-34~2 R 10~Mi 1
1 Co 15.35-58~2 R 11~Mi 2
` },
  { name: "Agosto", rows: `
1 Co 16~2 R 12—13~Mi 3
2 Co 1.1—2.4~2 R 14~Mi 4.1—5.1
2 Co 2.5—3.18~2 R 15—16~Mi 5.2-15
2 Co 4.1—5.10~2 R 17~Mi 6
2 Co 5.11—6.13~2 R 18~Mi 7
2 Co 6.14—7.16~2 R 19~Nah 1
2 Co 8~2 R 20—21~Nah 2
2 Co 9~2 R 22.1—23.34~Nah 3
2 Co 10~2 R 23.35—24.20~Hab 1
2 Co 11~2 R 25~Hab 2
2 Co 12~1 Cr 1—2~Hab 3
2 Co 13~1 Cr 3—4~Sof 1
Jn 1.1-18~1 Cr 5—6~Sof 2
Jn 1.19-34~1 Cr 7—8~Sof 3
Jn 1.35-51~1 Cr 9~Hag 1—2
Jn 2~1 Cr 10—11~Zac 1
Jn 3.1-21~1 Cr 12~Zac 2
Jn 3.22-36~1 Cr 13—14~Zac 3
Jn 4.1-26~1 Cr 15.1—16.7~Zac 4
Jn 4.27-42~1 Cr 16.8-43~Zac 5
Jn 4.43-54~1 Cr 17~Zac 6
Jn 5.1-18~1 Cr 18—19~Zac 7
Jn 5.19-47~1 Cr 20—22.1~Zac 8
Jn 6.1-24~1 Cr 22.2—23.32~Zac 9
Jn 6.25-59~1 Cr 24~Zac 10
Jn 6.60-71~1 Cr 25—26~Zac 11
Jn 7.1-24~1 Cr 27—28~Zac 12
Jn 7.25-52~1 Cr 29~Zac 13
Jn 8.1-20~2 Cr 1.1—2.16~Zac 14
Jn 8.21-47~2 Cr 2.17—5.1~Mal 1.1-2.9
Jn 8.48-59~2 Cr 5.2-14~Mal 2.10-16
` },
  { name: "Septiembre", rows: `
Jn 9.1-23~2 Cr 6~Mal 2.17—3.18
Jn 9.24-41~2 Cr 7~Mal 4
Jn 10.1-21~2 Cr 8~Sal 73
Jn 10.22-42~2 Cr 9~Sal 74
Jn 11.1-27~2 Cr 10—11~Sal 75
Jn 11.28-57~2 Cr 12—13~Sal 76
Jn 12.1-26~2 Cr 14—15~Sal 77
Jn 12.27-50~2 Cr 16—17~Sal 78.1-20
Jn 13.1-20~2 Cr 18~Sal 78.21-37
Jn 13.21-38~2 Cr 19~Sal 78.38-55
Jn 14.1-14~2 Cr 20.1—21.1~Sal 78.56-72
Jn 14.15-31~2 Cr 21.2—22.12~Sal 79
Jn 15.1—16.4~2 Cr 23~Sal 80
Jn 16.4-33~2 Cr 24~Sal 81
Jn 17~2 Cr 25~Sal 82
Jn 18.1-18~2 Cr 26~Sal 83
Jn 18.19-38~2 Cr 27—28~Sal 84
Jn 18.38—19.16~2 Cr 29~Sal 85
Jn 19.16-42~2 Cr 30~Sal 86
Jn 20.1-18~2 Cr 31~Sal 87
Jn 20.19-31~2 Cr 32~Sal 88
Jn 21~2 Cr 33~Sal 89.1-18
1 Jn 1~2 Cr 34~Sal 89.19-37
1 Jn 2~2 Cr 35~Sal 89.38-52
1 Jn 3~2 Cr 36~Sal 90
1 Jn 4~Esd 1—2~Sal 91
1 Jn 5~Esd 3—4~Sal 92
2 Jn~Esd 5—6~Sal 93
3 Jn~Esd 7—8~Sal 94
Jud~Esd 9—10~Sal 95
` },
  { name: "Octubre", rows: `
Ap 1~Neh 1—2~Sal 96
Ap 2~Neh 3~Sal 97
Ap 3~Neh 4~Sal 98
Ap 4~Neh 5.1—7.3~Sal 99
Ap 5~Neh 7.4—8.12~Sal 100
Ap 6~Neh 8.13—9.37~Sal 101
Ap 7~Neh 9.38—10.39~Sal 102
Ap 8~Neh 11~Sal 103
Ap 9~Neh 12~Sal 104.1-23
Ap 10~Neh 13~Sal 104.24-35
Ap 11~Est 1~Sal 105.1-25
Ap 12~Est 2~Sal 105.26-45
Ap 13~Est 3—4~Sal 106.1-23
Ap 14~Est 5.1—6.13~Sal 106.24-48
Ap 15~Est 6.14—8.17~Sal 107.1-22
Ap 16~Est 9—10~Sal 107.23-43
Ap 17~Is 1—2~Sal 108
Ap 18~Is 3—4~Sal 109.1-19
Ap 19~Is 5—6~Sal 109.20-31
Ap 20~Is 7—8~Sal 110
Ap 21—22~Is 9—10~Sal 111
1 Ts 1~Is 11—13~Sal 112
1 Ts 2.1-16~Is 14—16~Sal 113
1 Ts 2.17—3.13~Is 17—19~Sal 114
1 Ts 4~Is 20—22~Sal 115
1 Ts 5~Is 23—24~Sal 116
2 Ts 1~Is 25—26~Sal 117
2 Ts 2~Is 27—28~Sal 118
2 Ts 3~Is 29—30~Sal 119.1-32
1 Ti 1~Is 31—33~Sal 119.33-64
1 Ti 2~Is 34—35~Sal 119.65-96
` },
  { name: "Noviembre", rows: `
1 Ti 3~Is 36—37~Sal 119.97-120
1 Ti 4~Is 38—39~Sal 119.121-144
1 Ti 5.1-20~Jer 1—2~Sal 119.145-176
1 Ti 5.21—6.21~Jer 3—4~Sal 120
2 Ti 1~Jer 5—6~Sal 121
2 Ti 2~Jer 7—8~Sal 122
2 Ti 3~Jer 9—10~Sal 123
2 Ti 4~Jer 11—12~Sal 124
Tit 1~Jer 13—14~Sal 125
Tit 2~Jer 15—16~Sal 126
Tit 3~Jer 17—18~Sal 127
Flm~Jer 19—20~Sal 128
Stg 1~Jer 21—22~Sal 129
Stg 2~Jer 23—24~Sal 130
Stg 3~Jer 25—26~Sal 131
Stg 4~Jer 27—28~Sal 132
Stg 5~Jer 29—30~Sal 133
1 P 1~Jer 31—32~Sal 134
1 P 2~Jer 33—34~Sal 135
1 P 3~Jer 35—36~Sal 136
1 P 4~Jer 37—38~Sal 137
1 P 5~Jer 39—40~Sal 138
2 P 1~Jer 41—42~Sal 139
2 P 2~Jer 43—44~Sal 140
2 P 3~Jer 45—46~Sal 141
Gá 1~Jer 47—48~Sal 142
Gá 2~Jer 49—50~Sal 143
Gá 3.1-20~Jer 51—52~Sal 144
Gá 3.21—4.20~Lm 1—2~Sal 145
Gá 4.21-31~Lm 3—4~Sal 146
` },
  { name: "Diciembre", rows: `
Gá 5.1-15~Lm 5~Sal 147
Gá 5.16-26~Ez 1~Sal 148
Gá 6~Ez 2—3~Sal 149
Ef 1~Ez 4—5~Sal 150
Ef 2~Ez 6—7~Is 40
Ef 3~Ez 8—9~Is 41
Ef 4.1-16~Ez 10—11~Is 42
Ef 4.17-32~Ez 12—13~Is 43
Ef 5.1-20~Ez 14—15~Is 44
Ef 5.21-33~Ez 16~Is 45
Ef 6~Ez 17~Is 46
Fil 1.1-11~Ez 18~Is 47
Fil 1.12-30~Ez 19~Is 48
Fil 2.1-11~Ez 20~Is 49
Fil 2.12-30~Ez 21—22~Is 50
Fil 3~Ez 23~Is 51
Fil 4~Ez 24~Is 52
Col 1.1-23~Ez 25—26~Is 53
Col 1.24—2.19~Ez 27—28~Is 54
Col 2.20—3.17~Ez 29—30~Is 55
Col 3.18—4.18~Ez 31—32~Is 56
Lc 1.1-25~Ez 33~Is 57
Lc 1.26-56~Ez 34~Is 58
Lc 1.57-80~Ez 35—36~Is 59
Lc 2.1-20~Ez 37~Is 60
Lc 2.21-52~Ez 38—39~Is 61
Lc 3.1-20~Ez 40—41~Is 62
Lc 3.21-38~Ez 42—43~Is 63
Lc 4.1-30~Ez 44—45~Is 64
Lc 4.31-44~Ez 46—47~Is 65
Lc 5.1-26~Ez 48~Is 66
` },
];

export const BIBLE_READING_PLAN: BibleReadingDay[] = MONTHS.flatMap((month) =>
  month.rows.trim().split("\n").map((line, index) => {
    const readings = line.split("~");
    if (readings.length !== 3) {
      throw new Error(`La cita del plan bíblico del día ${index + 1} no tiene tres lecturas.`);
    }
    return {
      day: 0,
      month: month.name,
      dayOfMonth: index + 1,
      readings: readings as [string, string, string],
    };
  }),
).map((day, index) => ({ ...day, day: index + 1 }));

export const BIBLE_PLAN_MONTHS = MONTHS.map((month) => month.name);

if (BIBLE_READING_PLAN.length !== 365) {
  throw new Error(`El plan bíblico debe tener 365 días; tiene ${BIBLE_READING_PLAN.length}.`);
}
