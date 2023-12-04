const auto = [
    {
        device: 'fountain',
        action: 'on',
        sensor: 'tempurature',
        compare: '<',
        setvalue: '50',
    }, {
        device: 'lamp',
        action: 'on',
        sensor: 'light',
        compare: '>',
        setvalue: '500',
    }, {
        device: 'coolling',
        action: 'off',
        sensor: 'tempurature',
        compare: '>',
        setvalue: '20',
    },
]
if (topic === "dataSensor") {
    const dataSensor = JSON.parse(message);
    var temp_data = dataSensor.temperature || 0
    var humi_data = dataSensor.humidity || 0
    var light_data = dataSensor.light || 0
    var uv_data = dataSensor.uv || 0
    var soil1_data = dataSensor.soil1 || 0
    var soil2_data = dataSensor.soil2 || 0

    var sql = "insert into sensor_data(temperature, humidity, light, uv, soil1, soil2) value ( " + temp_data + " , " + humi_data + " ," + light_data + "," + uv_data + "," + soil1_data + "," + soil2_data + ")"
    con.query(sql, function (err, result) {
        if (err) throw err
    })
    io.emit('sensor_data', {
        temp: temp_data,
        humi: humi_data,
        light: light_data,
        uv: uv_data,
    });
    io.emit('soil', {
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
        },
    ]

    var sql = 'SELECt * FROM autofunction'
    con.query(sql, function (err, result) {
        if (err) throw err
        const auto = result;

        sensors.forEach((sensor) => {
            const matchedRules = auto.filter((rule) => rule.sensor === sensor.name);
            matchedRules.forEach((rule) => {
                if ((rule.compare === '<' && sensor.value < rule.setvalue) ||
                    (rule.compare === '>' && sensor.value > rule.setvalue)) {
                    action(rule.device, rule.action);
                }
            });
        });
    })
}


var devices = [
    {
        device: "Fountain",
        relay: "r0"
    },
    {
        device: "Coolling",
        relay: "r1"
    },
    {
        device: "Warming",
        relay: "r4"
    },
    {
        device: "Dome",
        relay: "r6"
    },
    {
        device: "Lamp",
        relay: "r7"
    },
    {
        device: "Other",
        relay: "r8"
    },
];

function action(deviceName, action) {
    devices.forEach((device) => {
        if (device.device === deviceName) {
            if (action === 'on') {
                client.publish(device.relay, '1');
            } else if (action === 'off') {
                client.publish(device.relay, '0');
            }
        }
    });
}