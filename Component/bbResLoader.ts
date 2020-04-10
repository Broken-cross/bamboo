import bb from "../bb";
import ResLoader, {EventType} from "../Service/ResLoader";

const { ccclass, property } = cc._decorator;

@ccclass
export default class bbResLoader extends cc.Component {
    @property(cc.Label)
    label: cc.Label;
    @property(cc.ProgressBar)
    progressBar: cc.ProgressBar;

    start() {
        bb.on(EventType.UPDATE_PROCESS, (completedCount: number, totalCount: number, desc: string) => {
            if(this.label) {
                this.label.string = `(${completedCount}/${totalCount})`;
            }
            this.progressBar.progress = completedCount / totalCount;
        })
    }
};