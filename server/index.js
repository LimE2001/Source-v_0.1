const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mysql = require('mysql');
const mqtt = require("mqtt");
const app = express();
const port = 3001;
const server = http.createServer(app);
const { Server } = require("socket.io");
const cors = require('cors');
const { error, Console } = require('console');

app.use(cors())

const io = new Server(server, {
    cors: "http://localhost:5173",
    methods: ["GET", "POST"],
});

io.on("connection", (socket) => {
    console.log("new connection", socket.id)
});

server.listen(port, () => {
    console.log(`Server chạy trên port: ${port}`);
});

app.use(express.static(path.join(__dirname, 'dist')));

// Định tuyến cho tệp index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "datasmart"
});

con.connect((err) => {
    if (err) throw err;
    console.log("Đã kết nối với MySQL!");

    // var sql = "DROP TABLE sensor_vip";
    // con.query(sql, function (err, result) {
    //   if (err) throw err;
    //   console.log("xóa bảng data thành công");
    // }); 
    //tạo bảng
    var sql = "CREATE TABLE IF NOT EXISTS esp (id int(10) auto_increment primary key, username text(10),name text(10), macid text(10), chipid text(10), time_x TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    con.query(sql, function (err, result) {
        if (err) {
            throw err
        } else {
            if (result.warningCount === 0) {
                console.log("Bảng esp đã tạo thành công.");
            } else {
                console.log("Đã tồn tại bảng esp.");
            }
        }
    });

    var sql = "CREATE TABLE IF NOT EXISTS sensor_data (id int(10) auto_increment primary key, temperature float(10),humidity float(10),light float(10),uv float(10), soil1 float(10), soil2 float(10), time_x TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    con.query(sql, function (err, result) {
        if (err) {
            throw err
        } else {
            if (result.warningCount === 0) {
                console.log("Bảng sensor đã tồn tại hoặc đã được tạo thành công.");
            } else {
                console.log("Đã tạo bảng sensor.");
            }
        }
    });

    var sql = "CREATE TABLE IF NOT EXISTS user (id int(10) auto_increment primary key, name text(10),userName text(10),passWord text(10),avt BLOB, access text(10),esp text(10),auto int(2), dev1 int(2), dev2 int(2), dev3 int(2), dev4 int(2), dev5 int(2), dev6 int(2), time_x TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    con.query(sql, function (err, result) {
        if (err) {
            throw err
        } else {
            if (result.warningCount === 0) {
                console.log("Bảng use đã tồn tại hoặc đã được tạo thành công.");
            } else {
                console.log("Đã tạo bảng user");
            }
        }
    });

    var sql = "CREATE TABLE IF NOT EXISTS timersetup (id int(10) auto_increment primary key,macid text(10), weekdays text(10), board text(10), hour text(10), minuter text(10),task text(10),action text(10), time_x TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    con.query(sql, function (err, result) {
        if (err) {
            throw err
        } else {
            if (result.warningCount === 0) {
                console.log("Bảng time đã tồn tại hoặc đã được tạo thành công.");
            } else {
                console.log("Đã tạo bảng time.");
            }
        }
    });


    var sql = "CREATE TABLE IF NOT EXISTS autofunction (id int(10) auto_increment primary key,macid text(10),weekdays text(10), board text(10), hourstart text(10), minutestart text(10),hourend text(10), minuteend text(10), device text(10), action text(10), sensor text(10), compare text(10), setvalue text(10), time_x TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    con.query(sql, function (err, result) {
        if (err) {
            throw err
        } else {
            if (result.warningCount === 0) {
                console.log("Bảng auto đã tạo thành công.");
            } else {
                console.log("Đã tồn tại bảng auto.");
            }
        }
    });
});

// const { count } = require('console');
const client = mqtt.connect('mqtt:net-radio.vov.link');
// const client = mqtt.connect('mqtt://192.168.0.4');

// biến toàn cục
let espDevices;
const mqttTopics = {};
let state_auto;
let espUser;
let previousDataState = null;
let dayOfWeek;

function getDayOfWeek(date) {
    const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return daysOfWeek[date.getDay()];
}

let today;
let hourNow;
let minuteNow;

const devices = [
    {
        device: "Fountain",
        dev: "DEV1"
    },
    {
        device: "Coolling",
        dev: "DEV2"
    },
    {
        device: "Warming",
        dev: "DEV3"
    },
    {
        device: "Dome",
        dev: "DEV4"
    },
    {
        device: "Lamp",
        dev: "DEV5"
    },
    {
        device: "Other",
        dev: "DEV6"
    },
];
let dataAutoEsp = []


//đăng nhập//
let usernameinput = 'LimE';
//thành công

client.on("connect", () => {
    console.log("MQTT connected");
    var sql = "SELECT * FROM esp";
    con.query(sql, function (err, result) {
        if (err) throw err;
        espDevices = result;
        // console.log(espDevices)
        espDevices.forEach((device) => {
            const deviceId = device.macid;
            mqttTopics[deviceId] = {
                connectDevice: `connectDevice${deviceId}`,
                dataAutoEsp: `dataAutoEsp${deviceId}`,
                dataPin: `dataPin${deviceId}`,
                dataSensor: `dataSensor${deviceId}`,
                success: `connectSuccess${deviceId}`,
            };
            client.subscribe(mqttTopics[deviceId].connectDevice);
            client.subscribe(mqttTopics[deviceId].dataAutoEsp);
            client.subscribe(mqttTopics[deviceId].dataPin);
            client.subscribe(mqttTopics[deviceId].dataSensor);
            client.publish(mqttTopics[deviceId].success, "1");
        });
    });
});

client.on("message", (topic, message) => {
    // console.log( mqttTopics)

    espDevices.forEach((device) => {
        const deviceId = device.macid;
        mqttTopics[deviceId] = {
            connectDevice: `connectDevice${deviceId}`,
            dataAutoEsp: `dataAutoEsp${deviceId}`,
            dataPin: `dataPin${deviceId}`,
            dataSensor: `dataSensor${deviceId}`,
            success: `connectSuccess${deviceId}`,
        };
        if (topic === mqttTopics[deviceId].connectDevice) {
            const data = JSON.parse(message);
            var name = data.name
            var boardId = data.chip
            var mac = data.mac
            io.emit("notification", data)
            client.publish(mqttTopics[deviceId].success, "1")
            // console.log(boardId)
            console.log(mac)
        }

        if (topic === mqttTopics[deviceId].dataAutoEsp) {
            const data = JSON.parse(message);
            // console.log('data',data)
            let tasklast = false
            dataAutoEsp.forEach((lastData, index) => {
                if (lastData.task == data.task) {
                    dataAutoEsp[index] = data
                    tasklast = true
                    console.log("update")
                }
            })
            if (!tasklast) {
                dataAutoEsp.push(data)
            }
            // dataAutoEsp.sort((a, b) => {
            //     // Sử dụng hàm localeCompare để so sánh chuỗi theo thứ tự từ điển
            //     return a.task.localeCompare(b.task);
            // });
            dataAutoEsp.sort((a, b) => {
                // Trích xuất số từ chuỗi "task"
                const taskNumberA = parseInt(a.task.replace(/\D/g, ''), 10);//a.task.replace(/\D/g, ''): Loại bỏ tất cả các ký tự không phải là số từ chuỗi a.task.
                const taskNumberB = parseInt(b.task.replace(/\D/g, ''), 10);//parseInt(..., 10): Chuyển đổi chuỗi số thành số nguyên (base 10).
                return taskNumberA - taskNumberB;
            });
            // console.log(dataAutoEsp)
            io.emit("dataEspOff", dataAutoEsp)
        }

        if (topic === mqttTopics[deviceId].dataPin) {
            const data = JSON.parse(message);
            var esp = data.esp
            state_auto = data.state_auto
            var state_1 = data.state_1
            var state_2 = data.state_2
            var state_3 = data.state_3
            var state_4 = data.state_4
            var state_5 = data.state_5
            var state_6 = data.state_6
            // console.log(data)
            io.emit(`deviceAuto`, {
                state: state_auto,
                esp: esp
            })
            io.emit(`device1`, {
                state: state_1,
                esp: esp
            })
            io.emit(`device2`, {
                state: state_2,
                esp: esp
            })
            io.emit(`device3`, {
                state: state_3,
                esp: esp
            })
            io.emit(`device4`, {
                state: state_4,
                esp: esp
            })
            io.emit(`device5`, {
                state: state_5,
                esp: esp
            })
            io.emit(`device6`, {
                state: state_6,
                esp: esp
            })

            io.emit("getState", {
                esp: esp,
                deviceAuto: state_auto,
                device1: state_1,
                device2: state_2,
                device3: state_3,
                device4: state_4,
                device5: state_5,
                device6: state_6,
            })
        }

        if (topic === mqttTopics[deviceId].dataSensor) {
            const dataSensor = JSON.parse(message);
            // console.log(dataSensor)
            var esp = dataSensor.esp
            var temp_data = dataSensor.temperature || 0
            var humi_data = dataSensor.humidity || 0
            var light_data = dataSensor.light || 0
            var uv_data = dataSensor.uv || 0
            var soil1_data = dataSensor.soil1 || 0
            var soil2_data = dataSensor.soil2 || 0

            // var sql = "insert into sensor_data(temperature, humidity, light, uv, soil1, soil2) value ( " + temp_data + " , " + humi_data + " ," + light_data + "," + uv_data + "," + soil1_data + "," + soil2_data + ")"
            // con.query(sql, function (err, result) {
            //     if (err) throw err
            // })
            // console.log(esp)
            io.emit('sensor_data', {
                esp: esp,
                temp: temp_data,
                humi: humi_data,
                light: light_data,
                uv: uv_data,
            });
            io.emit('soil', {
                esp: esp,
                soil1: soil1_data,
                soil2: soil2_data
            })

            const sensors = [
                {
                    name: 'temperature',
                    value: temp_data
                }, {
                    name: 'humidity',
                    value: humi_data
                }, {
                    name: 'light',
                    value: light_data
                }, {
                    name: 'uv',
                    value: uv_data
                }, {
                    name: 'soil1',
                    value: soil1_data
                }, {
                    name: 'soil2',
                    value: soil2_data
                },

            ]
            // console.log(temp_data) 
            autoFunction(sensors)


        }
    })

});

// const mqttStatus = {};
function autoFunction(sensors) {
    if (
        state_auto == 1
        // true
    ) {
        var sql = `SELECt * FROM autofunction WHERE weekdays = '${dayOfWeek}'`
        con.query(sql, function (err, result) {
            if (err) throw err
            const dataAuto = result;
            // console.log(dataAuto)
            // console.log(`Today: ${dayOfWeek}`);

            // console.log(`Time: ${hourNow}:${minuteNow}`)
            dataAuto.forEach((auto) => {
                if (
                    hourNow >= auto.hourstart
                    && minuteNow >= auto.minutestart
                    && hourNow <= auto.hourend
                    && minuteNow <= auto.minuteend
                ) {
                    // console.log(auto)
                    const matchedRules = sensors.filter((sensor) => sensor.name === auto.sensor)
                    // console.log(matchedRules)
                    // matchedRules.forEach((rule) => {
                    //     if (
                    //         (auto.compare === '<' && rule.value < auto.setvalue)
                    //         || (auto.compare === '>' && rule.value > auto.setvalue)
                    //     ) {
                    //         console.log(auto.device)
                    //         actionAutoFunction(auto.macid, auto.device, auto.action);
                    //     }
                    // })

                    if (
                        (auto.compare === '<' && matchedRules[0].value < auto.setvalue)
                        || (auto.compare === '>' && matchedRules[0].value > auto.setvalue)
                    ) {
                        console.log(auto.macid)
                        actionAutoFunction(auto.macid, auto.device, auto.action);
                    }

                }
            })

        })
    }
}

function actionAutoFunction(boardEsp, deviceEsp, action) {
    devices.forEach((device) => {
        if (device.device === deviceEsp) {
            // if (!mqttStatus[deviceName] || mqttStatus[deviceName] !== action) {
            // console.log(device.dev)
            if (action === 'On') {
                client.publish(`${device.dev}${boardEsp}`, '1');
            } else if (action === 'Off') {
                client.publish(`${device.dev}${boardEsp}`, '0');
            }
            // mqttStatus[deviceName]   = action
            // }
        }
    });
}

function customSort(a, b) {
    const daysOrder = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const dayA = daysOrder.indexOf(a.weekdays);
    const dayB = daysOrder.indexOf(b.weekdays);

    if (dayA !== dayB) {
        return dayA - dayB;
    }

    if (a.hour !== b.hour) {
        return a.hour - b.hour;
    }

    return a.minuter - b.minuter;
}

function addDataAuto(dataAuto) {
    if (dataAuto.length > 0) {
        const lastItem = dataAuto[dataAuto.length - 1];
        var sql = "INSERT INTO autofunction (macid,weekdays, board, hourstart, minutestart, hourend, minuteend, device, action, sensor, compare, setvalue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const values = [lastItem.macid, lastItem.weekdays, lastItem.board, lastItem.hourstart, lastItem.minutestart, lastItem.hourend, lastItem.minuteend, lastItem.device, lastItem.action, lastItem.sensor, lastItem.compare, parseInt(lastItem.setvalue)];
        con.query(sql, values, function (err, result) {
            if (err) throw err;
            console.log("Inserted a record");
        });
        // console.log(lastItem); 
    }
    var sql = "SELECT * FROM autofunction";

    con.query(sql, function (err, result) {
        if (err) throw err;
        // console.log(result);
        const sortedData = result.sort(customSort);
        io.emit("getAuto", sortedData);
    });
}

function deleteDataAuto(id) {
    var sql = 'DELETE FROM autofunction WHERE id = ?';
    con.query(sql, id, (error, results) => {
        if (error) {
            console.error('Error deleting data:', error);
        } else {
            console.log('Data deleted successfully');
            io.emit('dataAutoDeleted', id);
        }
    });
}

function updateAuto(data) {
    const id = data.id;
    // const dataUpdate = {
    //     device: data.device,
    //     action: data.action,
    //     sensor: data.sensor,
    //     compare: data.compare,
    //     setvalue: data.setvalue,
    // }

    var sql = 'UPDATE autofunction SET ? WHERE id = ?'
    con.query(sql, [data, id], (error, results) => {
        if (error) {
            console.error('Error update data:', error);
        } else {
            // console.log('Data update successfully');
            var sql = "SELECT * FROM autofunction";
            con.query(sql, function (err, result) {
                if (err) throw err;
                console.log(result);
                io.emit("getUpdateAuto", result);
            });
        }
    });
}

function setTimer(set) {
    if (set.length > 0) {
        // console.log(espDevices)
        const lastItem = set[set.length - 1];
        // const espBoard = espDevices.filter((device) => {
        //     return device.name == lastItem.board
        // })
        // console.log(espBoard)
        const sql = "INSERT INTO timersetup (macid, weekdays, board, hour, minuter, task, action) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const values = [lastItem.macid, lastItem.weekdays, lastItem.board, parseInt(lastItem.hour), parseInt(lastItem.minuter), lastItem.task, lastItem.action];
        con.query(sql, values, function (err, result) {
            if (err) throw err;
        });
    }

    var sql = "SELECT * FROM timersetup";
    con.query(sql, function (err, result) {
        if (err) throw err;
        // console.log(result);

        const sortedData = result.sort(customSort);
        io.emit("getTimerData", sortedData);
        var data = sortedData.filter((data) => {
            return data.weekdays == dayOfWeek
        })
        io.emit("getTimeData", data);
    });
}

function deleteSetTimer(id) {
    const sql = 'DELETE FROM timersetup WHERE id = ?';

    con.query(sql, id, (error, results) => {
        if (error) {
            console.error('Error deleting data:', error);
        } else {
            console.log('Data deleted successfully');
            io.emit('dataDeleted', id);
            var sql = `SELECT * FROM timersetup WHERE weekdays = '${dayOfWeek}'`;
            // var sql = `SELECT * FROM timersetup`;
            con.query(sql, function (err, result) {
                if (err) throw err;
                console.log(result);
                const sortedData = result.sort(customSort);

                // var data = result.filter((data) => {
                //     return data.weekdays == dayOfWeek
                // })
                io.emit("getTimeData", sortedData);
            })
        }
    });
}

function updateSetTimer(data) {
    // console.log(data)
    // const id = data.id;
    // const dataUpdate = {
    //     weekdays: data.weekdays,
    //     task: data.task,
    //     action: data.action,
    //     hour: data.hour,
    //     minuter: data.minuter,
    // }
    var sql = 'UPDATE timersetup SET ? WHERE id = ?'
    con.query(sql, [data, data.id], (error, results) => {
        if (error) {
            console.error('Error update data:', error);
        } else {
            // console.log('Data update successfully');
            var sql = "SELECT * FROM timersetup";
            con.query(sql, function (err, result) {
                if (err) throw err;
                // console.log(result);
                const sortedData = result.sort(customSort);
                io.emit("getTimerData", sortedData);
                var data = sortedData.filter((data) => {
                    return data.weekdays == dayOfWeek
                })
                io.emit("getTimeData", data);
            });
        }
    });
}

function addBoard(data) {
    if (data.macid) {
        // const lastItem = data[data.length - 1];
        // const values = [lime, lastItem.name, lastItem.macid, lastItem.chipid];
        const sql = `INSERT INTO esp (username, name, macid, chipid) VALUES ('${usernameinput}', '${data.name}', '${data.macid}', '${data.chipid}')`;
        con.query(sql, function (err, result) {
            if (err) throw err;
        });
    }
    var sql = "SELECT * FROM esp";
    con.query(sql, function (err, result) {
        if (err) throw err;
        // console.log(result);
        espDevices = result
        io.emit("getDataBoard", espDevices);
    });
    var sql = `SELECT name FROM esp WHERE macid = '${espUser}'`
    con.query(sql, (err, result) => {
        err ? console.error(err)
            : io.emit('boardUse', result[0])
    })
}

function rotateBoard(macId) {
    var sql = `UPDATE user SET esp = '${macId}' WHERE userName = '${usernameinput}'`
    con.query(sql, (err, result) => {
        if (err) throw err;
        var sql = `SELECT esp FROM user WHERE userName = '${usernameinput}'`
        con.query(sql, (err, result) => {
            if (err) throw err
            if (result.length > 0) { espUser = result[0].esp }
        })
    })
    var sql = `SELECT name FROM esp WHERE macid = '${macId}'`
    con.query(sql, (err, result) => {
        err ? console.error(err)
            : io.emit('boardUse', result[0])
    })
}

function updateBoard(data) {
    console.log(data)
    var sql = `UPDATE esp SET name = ?, chipid = ?, macid = ? WHERE id = '${data.id}'`
    con.query(sql, [data.name, data.chipid, data.macid], (err, result) => {
        if(err) throw err
        var sql = 'SELECT * FROM esp'
        con.query(sql, (err, result) => {
            if (err) throw err
            io.emit('getDataBoard', result)
        })
    })
}
         

function deleteBoard(id) {
    var sql = `DELETE FROM esp WHERE id = '${id}'`
    con.query(sql, (err, result) => {
        err ? console.error(err)
            : io.emit('deletedBoard', id)
    })
}

function setAutoEsp(data) {
    console.log(data)
    if (data.length > 0) {
        const lastItem = data[data.length - 1];
        const jsonString = JSON.stringify(lastItem);
        client.publish(`setauto${espUser}`, jsonString)
        console.log(jsonString)
    }
}

function deleteAutoEsp(data) {
    console.log(data)
    // console.log(dataAutoEsp)
    dataAutoEsp = dataAutoEsp.filter((dataAuto) => {
        return dataAuto.task != data
    })
    // console.log(dataAutoEsp)
    io.emit("dataEspOff", dataAutoEsp)

    // dataAutoEsp = []
    client.publish(`REMOVETASK${espUser}`, data)
}

io.on("connection", (socket) => {
    console.log('đã kết nối người dùng Socket-IO');

    var sql = `SELECT * FROM user WHERE userName = '${usernameinput}'`
    con.query(sql, function (err, result) {
        if (err) throw err;
        // console.log(result.length)
        if (result.length > 0) {
            espUser = result[0].esp
            // console.log("ok")
        }
    })

    //hàm rỗng
    socket.on('espDevices', () => {
        io.emit('getEspDevices', espDevices)
    })

    socket.on("resetWifi", () => {
        client.publish(`RESET${espUser}`, "1")
        console.log(`RESET${espUser}`)
    });

    socket.on("table", () => {
        var sql = `SELECT * FROM timersetup WHERE weekdays = '${dayOfWeek}'`;
        // var sql = `SELECT * FROM timersetup`;
        con.query(sql, function (err, result) {
            if (err) throw err;
            console.log(result);
            const sortedData = result.sort(customSort);

            // var data = result.filter((data) => {
            //     return data.weekdays == dayOfWeek
            // })
            io.emit("getTimeData", sortedData);
        });
        var sql = `SELECT * FROM user WHERE userName = '${usernameinput}'`;
        con.query(sql, function (err, result) {
            if (err) throw err;
            let dataUser
            if (result.length > 0) {
                dataUser = result
                espUser = result[0].esp
            }
            // console.log(espUser)
            // console.log(espUser)
            // console.log(result);
            // io.emit("dataUser", dataUser)
            var sql = `SELECT name, macid FROM esp WHERE macid = '${espUser}'`
            con.query(sql, (err, result) => {
                err ? console.error(err)
                    : io.emit("dataUser", {
                        dataUser: dataUser,
                        nameBoard: result
                    })
                // console.log(result)
            })
        });
    })

    socket.on('boardName', () => {
        var sql = `SELECT name, macid FROM esp WHERE macid = '${espUser}'`
        con.query(sql, (err, result) => {
            err ? console.error(err)
                : io.emit("boardUse", result[0])

            // console.log(result)
        })
        client.publish(`setauto${espUser}`, "")
    })

    // const socketTopic = 
    // button
    socket.on("dAuto", (state) => {

        // io.emit('r1', state)
        if (state == 0) {
            client.publish(`AUTO${espUser}`, "0")
        } else {
            client.publish(`AUTO${espUser}`, "1")
        }
    });

    socket.on("d1", (state) => {

        // io.emit('r1', state)
        if (state == 0) {
            client.publish(`DEV1${espUser}`, "0")
            console.log(`DEV1${espUser}: off`)
        } else {
            client.publish(`DEV1${espUser}`, "1")
            console.log(`DEV1${espUser}: on`)
        }
        // var sql = `insert into stateboard (device, state) value (1, ${state})`
        // con.query(sql, function (err, result) {
        //     if (err) throw err
        // })
    });

    socket.on("d2", (state) => {
        if (state == 0) {
            client.publish(`DEV2${espUser}`, "0")
        } else {
            client.publish(`DEV2${espUser}`, "1")
        }
    });

    socket.on("d3", (state) => {
        if (state == 0) {
            client.publish(`DEV3${espUser}`, "0")
        } else {
            client.publish(`DEV3${espUser}`, "1")
        }
    });

    socket.on("d4", (state) => {
        if (state == 0) {
            client.publish(`DEV4${espUser}`, "0")
        } else {
            client.publish(`DEV4${espUser}`, "1")
        }
    });

    socket.on("d5", (state) => {
        if (state == 0) {
            client.publish(`DEV5${espUser}`, "0")
        } else {
            client.publish(`DEV5${espUser}`, "1")
        }
    });

    socket.on("d6", (state) => {
        if (state == 0) {
            client.publish(`DEV6${espUser}`, "0")
        } else {
            client.publish(`DEV6${espUser}`, "1")
        }
    });

    //set Timer
    socket.on("setTimer", (set) => {
        setTimer(set)
    })

    //xóa Timer
    socket.on('deleteData', (id) => {
        deleteSetTimer(id)
    });
    //update Timer
    socket.on("updateTimer", (data) => {
        updateSetTimer(data)
    });

    //set Auto
    socket.on("postAuto", (dataAuto) => {
        addDataAuto(dataAuto)
    })

    //xóa Auto
    socket.on('deleteDataAuto', (id) => {
        deleteDataAuto(id)
    });

    //update Auto
    socket.on("updateAuto", (data) => {
        // console.log(data)
        updateAuto(data)
    });

    //add board 
    socket.on("dataBoard", (data) => {
        addBoard(data)
    })

    //rotate board
    socket.on('rotateBoard', (macId) => {
        rotateBoard(macId)
    })

    //update board
    socket.on("updateBoard", (data) => {
        updateBoard(data)
    })

    //delete board
    socket.on('deleteBoard', (id) => {
        deleteBoard(id)
    })

    //set auto esp off
    socket.on('postAutoForEsp', (data) => {
        setAutoEsp(data)
    })

    //delete auto esp off
    socket.on('deleteTaskAuto', (data) => {
        deleteAutoEsp(data)
    })

});

//so sánh đặt lịch
const timerControl = () => {
    today = new Date();
    dayOfWeek = getDayOfWeek(today);
    hourNow = today.getHours();
    minuteNow = today.getMinutes();

    // console.log(`Today: ${dayOfWeek}`);

    var sql = "SELECT * FROM timersetup WHERE weekdays = ? AND hour = ? AND minuter = ?";

    con.query(sql, [dayOfWeek, hourNow, minuteNow], function (err, result) {
        if (err) throw err;
        var datas = result;
        // console.log(datas)
        // console.log(`Time: ${hourNow}:${minuteNow}`)
        // console.log("")
        // console.log(data.macid)


        if (!previousDataState) {
            previousDataState = datas;
        } else if (JSON.stringify(datas) !== JSON.stringify(previousDataState)) {

            devices.forEach(device => {
                var theNew = datas.filter((data) => data.task == device.device);
                var onDevice = theNew.filter((data) => data.action === "ON");
                var offDevice = theNew.filter((data) => data.action === "OFF");

                if (onDevice.length > 0) {
                    console.log(onDevice)
                    onDevice.forEach(data => {
                        client.publish(`${device.dev}${data.macid}`, "1");
                        console.log(`${device.dev}${data.macid}`)
                    })
                    // console.log(device.board, device.dev, 'on')
                }

                if (offDevice.length > 0) {
                    offDevice.forEach(data => {
                        client.publish(`${device.dev}${data.macid}`, "0");
                        console.log(`${device.dev}${data.macid}`)
                    })
                    // console.log(device.board, device.dev, 'off')
                }
            });
            previousDataState = datas;
        }
    });
}

setInterval(timerControl, 5000)