import { HttpRequest } from "../Network/Http"

export enum Gender {
    UNKNOW,
    MALE,
    FEMALE,
}

export interface UserInfo {
    nickName: string;
    avatarUrl: string;
    gender: Gender, //性别 0：未知、1：男、2：女
    province: string,
    city: string,
    country: string,
}

class Wechat {
    userInfo: UserInfo;
    appId: string;
    openId: string;
    unionId: string;
    sessionKey: string;
    iv: string;

    canUse() {
        return cc.sys.platform == cc.sys.WECHAT_GAME
    }

    init(appId: string) {
        if (!this.canUse()) {
            return;
        }
        this.appId = appId;
    }

    async getUserInfo() {
        return new Promise<any>((resolve) => {
            if (this.userInfo) {
                resolve(this.userInfo);
                return;
            }
            wx.getSetting({
                success: (res) => {
                    console.log(res.authSetting)
                    if (res.authSetting["scope.userInfo"]) {
                        wx.getUserInfo({
                            success: (res) => {
                                var userInfo = res.userInfo
                                this.userInfo = {
                                    nickName: userInfo.nickName,
                                    avatarUrl: userInfo.avatarUrl,
                                    gender: userInfo.gender,
                                    province: userInfo.province,
                                    city: userInfo.city,
                                    country: userInfo.country,
                                };
                                resolve(this.userInfo);
                            }
                        })
                    } else {
                        let systemInfo = wx.getSystemInfoSync();
                        let width = systemInfo.windowWidth;
                        let height = systemInfo.windowHeight;
                        let button = wx.createUserInfoButton({
                            type: 'text',
                            text: '',
                            style: {
                                left: 0,
                                top: 0,
                                width: width,
                                height: height,
                                lineHeight: 40,
                                backgroundColor: '#00000000',
                                color: '#00000000',
                                textAlign: 'center',
                                fontSize: 10,
                                borderRadius: 4
                            }
                        });

                        button.onTap((res) => {
                            let userInfo = res.userInfo;
                            if (!userInfo) {
                                console.log(res.errMsg);
                                return;
                            }
                            this.userInfo = res.userInfo;
                            button.hide();
                            button.destroy();
                        });
                    }
                }
            })
        });
    }

    initUserInfoButton() {
        let systemInfo = wx.getSystemInfoSync();
        let width = systemInfo.windowWidth;
        let height = systemInfo.windowHeight;
        let button = wx.createUserInfoButton({
            type: 'text',
            text: '',
            style: {
                left: 0,
                top: 0,
                width: width,
                height: height,
                lineHeight: 40,
                backgroundColor: '#00000000',
                color: '#00000000',
                textAlign: 'center',
                fontSize: 10,
                borderRadius: 4
            }
        });

        button.onTap((res) => {
            let userInfo = res.userInfo;
            if (!userInfo) {
                console.log(res.errMsg);
                return;
            }
            this.userInfo = res.userInfo;
            button.hide();
            button.destroy();
        });
    }

    submitScore(key: string, score: number) {
        wx.setUserCloudStorage({
            KVDataList: [{ key, value: String(score) }],
            success: (ret) => {
                console.log("setUserCloudStore ok", ret);
            },
            fail: (ret) => {
                console.log("setUserCloudStorage fail", ret);
            },
            complete: (ret) => {
                console.log("setUserCloudStore complete", ret);
            }
        });
        cc.sys.localStorage.setItem(key, score);
    }

    getMyScore(key: string, cb: any) {
        var localScore = parseInt(cc.sys.localStorage.getItem(key)) || 0;
        return localScore;
    }

    submitRank(score: number) {
        wx.setUserCloudStorage({
            wxgame: {
                score,
                update_time: Date.parse(Date()) / 1000
            }
        })
    }

    postMessageOpenContent(cmd, data) {
        wx.getOpenDataContext().postMessage({
            cmd,
            data,
        });
    }

    async asyncHttpGet(req: HttpRequest) {
        return new Promise<any>((resolve, reject) => {
            wx.request({
                url: req.url,
                method: "GET",
                header: { Authorization: req.authorization },
                data: req.data,
                success: (res) => {
                    resolve(res.data);
                },
                fail: () => {
                    reject("post error");
                }
            })
        });
    }
    async asyncHttpPost(req: HttpRequest) {
        return new Promise<any>((resolve, reject) => {
            wx.request({
                url: req.url,
                method: "POST",
                header: { Authorization: req.authorization },
                data: req.data,
                success: (res) => {
                    resolve(res.data);
                },
                fail: () => {
                    reject("post error");
                }
            })
        });
    }

    httpGet(req: HttpRequest) {
        wx.request({
            url: req.url,
            method: "GET",
            header: { Authorization: req.authorization },
            data: req.data,
            success: (res) => {
                req.success && req.success(res.data);
            },
            fail: req.fail,
        })
    }
    httpPost(req: HttpRequest) {
        wx.request({
            url: req.url,
            method: "POST",
            header: { Authorization: req.authorization },
            data: req.data,
            success: (res) => {
                req.success && req.success(res.data);
            },
            fail: req.fail,
        })
    }

}

export default new Wechat();