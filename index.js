const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const crates = require("./crates.json");
const { PrismaClient } = require("@prisma/client");
const Papa = require("papaparse");
const R = require("remeda");

const exePath = path.dirname(process.execPath);
const dbPath = path.join(exePath, "database/yar.db");
const csvPath = path.join(exePath, "rewards.csv");
process.env["DATABASE_URL"] = `file:${dbPath}`;

const prisma = new PrismaClient();

const main = async () => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 7);

  const rewardsForPeriod = await prisma.rewards.findMany({
    where: {
      created_at: {
        gte: daysAgo,
      },
    },
  });

  const data = formatToCSV(rewardsForPeriod);
  fs.writeFileSync(csvPath, data, "utf-8");

  const firsCases = new Set();
  let secondCasesCount = 0;
  for (const reward of rewardsForPeriod) {
    if (firsCases.has(reward.client_id)) {
      secondCasesCount++;
    } else {
      firsCases.add(reward.client_id);
    }
  }
  const firsCasesCount = firsCases.size;
  console.log(
    `Усього скриньок отримано: ${rewardsForPeriod.length}, перших: ${firsCasesCount}, бонусних: ${secondCasesCount}`
  );
  const countByRewardArray = rewardsForPeriod.reduce((acc, obj) => {
    const rewardIndex = acc.findIndex((r) => r.defIndex === obj.item_id);
    if (rewardIndex === -1) {
      acc.push({ defIndex: obj.item_id, count: 1 });
    } else {
      acc[rewardIndex].count++;
    }
    return acc;
  }, []);
  const sortedRewards = countByRewardArray.sort((a, b) => {
    return b.count - a.count;
  });
  for (const reward of sortedRewards) {
    let caseName = GetCaseNameByDefIndex(reward.defIndex);
    if (reward.defIndex.toString() === "4003") {
      caseName = "Операція Контрнаступ!";
    } else if (reward.defIndex.toString() === "4001") {
      caseName = "Слава Україні!";
    }
    console.log(`"${caseName}": ${reward.count}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("");
  rl.question("Для завершення роботи натисніть Enter...", () => {
    rl.close();
  });
};
main();

function GetCaseNameByDefIndex(defIndex) {
  for (const crate of crates) {
    if (crate.id.includes(defIndex.toString())) {
      return crate.name;
    }
  }
  return "unknown crate";
}

function formatToCSV(rewards) {
  const dataObj = {};

  for (const reward of rewards) {
    if (!dataObj.hasOwnProperty(reward.client_id)) {
      dataObj[reward.client_id] = {};
      dataObj[reward.client_id]["Name"] = reward.client_id;
      dataObj[reward.client_id]["Count"] = 1;
      dataObj[reward.client_id]["Rewards"] = `"${GetCaseNameByDefIndex(
        reward.item_id
      )}"`;
    } else {
      dataObj[reward.client_id].Count += 1;
      dataObj[reward.client_id].Rewards += `, "${GetCaseNameByDefIndex(
        reward.item_id
      )}"`;
    }
  }

  const sortedData = Object.values(dataObj).sort((a, b) => {
    if (a.Count > b.Count) {
      return -1;
    } else if (a.Count < b.Count) {
      return 1;
    } else {
      return 0;
    }
  });
  const formatData = Papa.unparse(sortedData, { delimiter: ";" });
  return formatData;
}
