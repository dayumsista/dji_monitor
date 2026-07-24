import configparser, json, time, requests, random
from pathlib import Path
from datetime import datetime
from decimal import Decimal

BASE=Path(__file__).parent
LOG_DIR=BASE/"logs"
LOG_DIR.mkdir(exist_ok=True)
STATE=BASE/"dji_monitor_state.json"

cfg=configparser.ConfigParser(interpolation=None)
cfg.read(BASE/"dji_monitor.ini", encoding="utf-8-sig")

URL=cfg["network"]["recycle_rules_url"]
TIMEOUT=int(cfg["network"].get("request_timeout_seconds",20))


COOKIE_DIR=BASE/"cookies"

COOKIES=[]

if COOKIE_DIR.exists():
    for f in COOKIE_DIR.glob("*.txt"):
        c=f.read_text(encoding="utf-8").strip()
        if c:
            COOKIES.append(c)


COOKIE_INDEX=0


def get_cookie():
    global COOKIE_INDEX

    if not COOKIES:
        return ""

    cookie=COOKIES[COOKIE_INDEX]

    COOKIE_INDEX += 1

    if COOKIE_INDEX >= len(COOKIES):
        COOKIE_INDEX=0

    return cookie


INTERVAL=int(cfg["monitor"].get("check_interval_seconds",300))
RULE_KEY=cfg["monitor"].get("target_rule_key","御 Mavic Pro")
TARGET=Decimal(cfg["monitor"].get("target_discount","5"))

PUSH_URL=cfg["pushplus"]["url"]
TOKEN=cfg["pushplus"]["token"]
TITLE=cfg["pushplus"]["title"]

def now():
    return datetime.now()

def log(msg):
    t=now()
    line=f"[{t:%Y-%m-%d %H:%M:%S}] {msg}"
    print(line)
    f=LOG_DIR/f"dji-monitor-{t:%Y-%m-%d-%H}.txt"
    with open(f,"a",encoding="utf-8") as x:
        x.write(line+"\n")

def load():
    if STATE.exists():
        try:return json.loads(STATE.read_text("utf-8"))
        except:return {}
    return {}

def save(x):
    STATE.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding="utf-8")

def get_items():
    headers={}

    cookie=get_cookie()
    log("使用cookie长度:"+str(len(cookie)))
    if cookie:
        headers["Cookie"]=cookie

    r=requests.get(
        URL,
        headers=headers,
        timeout=TIMEOUT
    )

    log("HTTP状态:"+str(r.status_code))

    data=r.json()
    if r.status_code != 200:
        log("请求失败:"+str(data))
        return {}
    log("返回类型:"+str(type(data)))

    if isinstance(data,dict):
        log("返回keys:"+str(data.keys()))

    items=data.get("data",{}).get("rules",{}).get(RULE_KEY,[])

    if items is None:
        log("rules为空")
        return {}

    r={}

    for i in items:
        try:
            if Decimal(str(i.get("discount")))==TARGET:
                k=str(i.get("newModelId") or i.get("id") or i.get("name"))
                r[k]={
                    "name":i.get("name","")
                }
        except Exception:
            pass

    return r
def push(text):
    try:
        r=requests.post(
            PUSH_URL,
            data={
                "token":TOKEN,
                "title":TITLE,
                "content":text
            },
            timeout=TIMEOUT
        )

        log("PushPlus返回:"+r.text)

        return True

    except Exception as e:
        log("推送异常:"+str(e))
        return False

def run():
    log("========== 开始扫描 ==========")
    log(f"规则: {RULE_KEY}")
    log(f"目标discount: {TARGET}")
    cur=get_items()
    old=load()
    log(f"历史状态数量: {len(old)}")
    log(f"当前discount=5数量: {len(cur)}")
    log("当前discount=5机型:")
    for v in cur.values():log("- "+v["name"])
    add={k:v for k,v in cur.items() if k not in old}
    rem={k:v for k,v in old.items() if k not in cur}

    log(f"新增数量: {len(add)}")
    log(f"消失数量: {len(rem)}")

    if add or rem:

        log("检测到变化")

        msg="DJI Mavic Pro discount=5变化\n\n"

        if add:
            log("新增机型:")
            msg += "新增:\n"

            for v in add.values():
                log("+ " + v["name"])
                msg += "+ " + v["name"] + "\n"

        if rem:
            log("消失机型:")
            msg += "\n消失:\n"

            for v in rem.values():
                log("- " + v["name"])
                msg += "- " + v["name"] + "\n"


        log("准备发送推送")

        if push(msg):
            log("推送成功")
            save(cur)
            log("状态保存完成")
        else:
            log("推送失败，状态未更新")

    else:
        log("无变化")
        log(f"{INTERVAL}秒后再次扫描")
        save(cur)

while True:
    try:run()
    except Exception as e:log("错误:"+str(e))
    time.sleep(INTERVAL)
