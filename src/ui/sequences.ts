import { RelationType, RewardConfig, SequenceConfig } from "../core/types";

const seq = (
  {
    id,
    atoms = id.replace(/[，|。|？|！]/g, "").split(""),
    relations = ["H", "V"],
    allowReverseMerge = true,
    score = 100,
  }: {
    id: string;
    atoms?: string[];
    reward?: RewardConfig;
    relations?: RelationType[];
    allowReverseMerge?: boolean;
    score?: number;
  }
): SequenceConfig => ({
  id,
  atoms,
  reward: { score },
  relations,
  allowReverseMerge,
})

export const configs: SequenceConfig[] = [
  // {
  //   id: "講到很多和我有關而又完全錯誤的事情",
  //   atoms: "講到很多和我有關而又完全錯誤的事情".split(""),
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
  //   seq({ id: "代数儿何" }),
  seq({ id: "這種成績，使人汗顏！如此成績，如何招生？" }),
  seq({ id: "不照規則，不會拿到求真書院的學位！", atoms: ["不照規則，", "不會拿到求真書院的學位！"] }),
  //   seq({ id: "章台柳，章台柳，昔日青青今在否。纵使长條似旧垂，也広攀折他人手。" })

  {
    id: "求真子弟，必须尋天人樂處，拓万古心胸。",
    atoms: ["求真子弟", "必须尋天人樂處", "拓万古心胸"],
    reward: { score: 100 },
    relations: ["H", "V"],
    allowReverseMerge: true
  },
  // {
  //   id: "今日中国，强敵环伺，科技卡膀，海疆未靖，幼苗未长，此誠危急存亡之秋也。",
  //   atoms: ["今日中国", "强敵环伺", "科技卡膀", "海疆未靖", "幼苗未长", "此誠危急存亡之秋也"],
  //   reward: { score: 100 },
  //   relations: ["H", "V"],
  //   allowReverseMerge: true
  // },
];
