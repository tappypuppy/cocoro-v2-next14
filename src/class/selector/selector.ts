class Selector {
    conversationCount: number;
    lastAction: string | null;
    selectedAction: string;

    constructor() {
        this.conversationCount = 0;
        this.lastAction = null;
        this.selectedAction = "";
    }

    selectAction(currentUtteranceType: string): string {
        /**
         * 聞き返しとそれ以外の行動を選択する。
         *
         * Args:
         *     currentUtteranceType: 現在の発話のタイプ（N, CT, ST）。
         *
         * Returns:
         *     選択された行動（AR、AF、など）。
         */

        // 聞き返しの確率を基本値として設定
        const rephrasingProbability = 0.66;

        // 聞き返しを選択する場合
        if (Math.random() < rephrasingProbability) {
            const rephrasingTypes = ["SiR", "DR", "MR", "AR", "SuR"];
            if (currentUtteranceType === "ST") {
                this.selectedAction = this.weightedRandomChoice(rephrasingTypes, [1, 2, 0, 2, 1]);
            } else if (currentUtteranceType === "CT") {
                this.selectedAction = this.weightedRandomChoice(rephrasingTypes, [1, 0, 0, 0, 1]);
            } else {
                this.selectedAction = this.weightedRandomChoice(rephrasingTypes, [1, 1, 0, 1, 1]);
            }
        } else {
            // 聞き返し以外を選択する場合
            const nonRephrasingTypes = ["AF", "EC", "GI", "QU", "RF", "ST"];
            if (currentUtteranceType === "ST") {
                this.selectedAction = this.weightedRandomChoice(nonRephrasingTypes, [0, 1, 1, 1, 1, 1]);
            } else {
                this.selectedAction = this.weightedRandomChoice(nonRephrasingTypes, [2, 1, 1, 1, 1, 1]);
            }
        }

        return this.selectedAction;
    }

    weightedRandomChoice(choices: string[], weights: number[]): string {
        const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < choices.length; i++) {
            if (random < weights[i]) {
                return choices[i];
            }
            random -= weights[i];
        }

        return choices[choices.length - 1];
    }
}

export default Selector;