const path = require("node:path");
const readline = require("node:readline");
const crates = require("./crates.json");
const { PrismaClient } = require("@prisma/client");

const dbPath = path.join(path.dirname(process.execPath), "database/yar.db");
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
    `Всего кейсов полученно: ${rewardsForPeriod.length}, основных: ${firsCasesCount}, бонусных: ${secondCasesCount}`
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
    const caseName = GetCaseNameByDefIndex(reward.defIndex);
    console.log(`"${caseName}": ${reward.count}`);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("");
  rl.question("Нажмите Enter, что бы завершить работу...", () => {
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
