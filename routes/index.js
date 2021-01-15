var express = require("express");
var router = express.Router();

var request = require('request');
var cheerio = require("cheerio");

var AWS = require('aws-sdk');
var fs = require('fs');

var mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

var key = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

AWS.config.region = 'us-east-1';

var s3 = new AWS.S3({
    "accessKeyId": "XXXXXXXXXXXXXXXXXXXX",
    "secretAccessKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
});

var lambda = new AWS.Lambda({
    "accessKeyId": "XXXXXXXXXXXXXXXXXXXX",
    "secretAccessKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
});

router.get("/", function(req, res, next) {
    res.render("main.ejs", {});
    res.end();
});

router.get("/test", function(req, res, next) {
    res.render("test.ejs", {});
    res.end();
});

router.get("/graph", function(req, res, next) {
    res.render("graph.ejs", {});
    res.end();
});

router.get("/hospital", function(req, res, next) {
    res.render("hospital.ejs", {});
    res.end();
});

router.post("/sdk_lambda", function(req, res, next) {
    const param = { "number": req.query.param };
    // const param = { "p1": "/", "p2": "123", "p3": "456" }; // parameter 여러 개
    var params = {
        FunctionName: "function_by_sdk", // or Function ARN
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(param)
    };
    lambda.invoke(params, function(error, data) {
        console.log("error value: " + error);
        //data.Payload is returned as a string, to check it, turn into JSON object
        let payload = JSON.parse(data.Payload);
        if (error) {
            console.log("Error invoking AWS " + error);
        } else {
            if (!payload.errorMessage) {
                console.log("no error");
                res.json({ new_data: payload.body });
                console.log(payload.body);
            } else {
                //Lambda error
                console.log("Lambda error");
                console.log(payload.errorMessage);
            }
        }
    });
});

router.get("/bus", function(req, res, next) {
    //console.log("id - " + req.query.id);
    var url = 'http://openapi.gbis.go.kr/ws/rest/busarrivalservice/station';
    var queryParams = '?' + encodeURIComponent('ServiceKey') + '=' + key; /* Service Key*/
    queryParams += '&' + encodeURIComponent('serviceKey') + '=' + encodeURIComponent(key); /* */
    queryParams += '&' + encodeURIComponent('stationId') + '=' + encodeURIComponent(req.query.id); /* */

    request({
        url: url + queryParams,
        method: 'GET'
    }, function(error, response, body) {
        //console.log('Response received', body);
        var $ = cheerio.load(body);
        var list = [];
        $("busArrivalList").each(function(index, item) {
            var bus = $(item).find('plateNo1').text();
            list[index] = bus;
        });
        //console.log(list);
        res.json({ new_data: list }); // page를 reload 하지 않고 data만 pass
    });
});

router.get("/bus_gateway", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/bus';
    var queryParams = '?number=' + req.query.id;
    request({
        url: url + resource + queryParams,
        method: 'GET'
    }, function(error, response, body) {
        if (error) console.log(error);
        console.log("바디" + body);
        console.log("JSON.parse(body).result" + JSON.parse(body).result);
        res.json({
            new_data: JSON.parse(body).result
        });
    });
});

router.get("/bus_lambda", function(req, res, next) {
    // const exp = { "op": "/", "la": "123", "ra": "456" };
    const exp = { "number": req.query.id };
    var params = {
        FunctionName: "hierarchy_test", // or Function ARN
        // the other options: Event or DryRun
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(exp)
    };
    lambda.invoke(params, function(error, data) {
        console.log("error value: " + error);
        //data.Payload is returned as a string, to check it, turn into JSON object
        let payload = JSON.parse(data.Payload);
        if (error) {
            console.log("Error invoking AWS " + error);
            // process error
        } else {
            // process payload
            // check for Lambda error  
            if (!payload.errorMessage) {
                console.log("no error");
                res.json({
                    new_data: JSON.parse(payload.body).result
                });
                console.log(payload.body);
            } else {
                //Lambda error
                console.log("Lambda error");
                console.log(payload.errorMessage);
            }
        }
    });
});

router.post("/folder", function(req, res, next) {
    // Bucket Creation Function
    function createBucket(params) {
        return new Promise(function(resolve, reject) {
            s3.createBucket(params, function(err, data) {
                if (err) reject(err); // an error occurred
                else resolve(data);
            });
        });
    }

    var test = async function() {
        console.log("jason-yoo-test-" + req.query.name);
        try {
            console.log('-- Create Bucket --');
            // Bucket Creation Request Parameters
            var cb_params = {
                Bucket: ("jason-yoo-test-" + req.query.name).toLowerCase()
            };
            var res1 = await createBucket(cb_params);
            console.log(res1);
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    test();

    res.json(); // response success to client
});

router.post("/file", function(req, res, next) {
    function createObject(params) {
        return new Promise(function(resolve, reject) {
            s3.upload(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            })
        });
    }

    var test = async function() {
        console.log(req.query.bucket_name);
        console.log(req.query.object_name);
        try {
            const co_params1 = {
                Bucket: req.query.bucket_name.toLowerCase(),
                Key: `images/${req.query.object_name.toLowerCase()}.jpg`, // S3 경로
                Body: fs.createReadStream(`./public/images/test/${req.query.object_name}.jpg`), // 로컬 경로
                ACL: 'public-read'
            };
            var res2 = await createObject(co_params1);
            console.log(res2);

        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    test();
    res.json(); // response success to client
});

async function insert_image_db(bucket_name, object_name) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/mongo';
    var queryParams = '?bucket_name=' + bucket_name + '&object_name=' + object_name;
    request({
        url: url + resource + queryParams,
        method: 'POST'
    }, function(error, response, body) {
        if (error) console.log(error);
        //console.log("바디" + body);
        //console.log("JSON.parse(body).result" + JSON.parse(body).result);
    });
}

router.post("/file2", function(req, res, next) {
    var bucket_name = req.query.bucket_name;
    var object_name = req.query.object_name;

    function createObject(params) {
        return new Promise(function(resolve, reject) {
            s3.upload(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            })
        });
    }

    var test = async function() {
        // console.log(req.query.bucket_name);
        // console.log(req.query.object_name);
        try {
            const co_params1 = {
                Bucket: bucket_name.toLowerCase(),
                Key: `images/${object_name.toLowerCase()}.jpg`, // S3 경로
                Body: fs.createReadStream(`./public/images/upload/${object_name}.jpg`), // 로컬 경로
                ACL: 'public-read'
            };
            var res2 = await createObject(co_params1);
            // console.log(res2);
            insert_image_db(bucket_name, object_name);

        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    test();

    res.json(); // response success to client
});

// router.post("/file_gateway", function(req, res, next) {
//     var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
//     var resource = '/image';
//     var queryParams = '?bucket_name=' + req.query.bucket_name + '&object_name=' + req.query.object_name;
//     request({
//             url: url + resource + queryParams,
//             method: 'POST',
//         },
//         function(error, response, body) {
//             if (error) console.log(error);
//             // console.log("JSON.parse(body).result" + JSON.parse(body).result);
//             console.log("body  " + body);
//             res.json({
//                 // new_data: JSON.parse(body).result
//             });
//         });
// });

// 버킷 생성
router.post("/s3", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/s3';
    var param = '?bucket_name=' + req.query.bucket_name;
    request({
        url: url + resource + param,
        method: 'POST'
    }, function(error, response, body) {
        if (error) console.log(error);
        // console.log("바디 " + JSON.parse(body).result);
        res.json({ new_data: body });
    });
});

router.get("/retrieve", function(req, res, next) {
    var bucket_name = req.query.bucket_name;
    var file_name = req.query.object_name;

    function retrieveObject(params) {
        return new Promise(function(resolve, reject) {
            s3.getObject(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    var test = async function() {
        try {
            const ro_params = {
                Bucket: bucket_name,
                Key: `images/${file_name}.jpg`, // S3 경로
            };
            var data = await retrieveObject(ro_params);
            // console.log("retrieved data");
            // console.log(JSON.stringify(data));
            // console.log(JSON.stringify(data.Body));
            // console.log(JSON.stringify(data.Body.data));
            //파일을 저장
            fs.writeFile('./public/images/download/' + file_name + '.jpg', data.Body, (e, d) => {
                if (e) console.log(e);
                else {
                    res.json({ file_name: file_name, image: data.Body });
                }
            });
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    // run the test
    test();
});

router.get("/get_file_list", function(req, res, next) {
    var bucket_name = req.query.bucket_name;

    var test = async function() {
        try {
            var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
            var resource = '/mongo';
            var queryParams = '?bucket_name=' + bucket_name;
            request({
                url: url + resource + queryParams,
                method: 'GET'
            }, function(error, response, body) {
                if (error) console.log(error);
                // console.log("바디" + body);
                console.log("JSON.parse(body).result" + JSON.parse(body).result);
                res.json({ file_list: JSON.parse(body).result });
            });
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    // run the test
    test();
});

router.get("/retrieve2", function(req, res, next) {
    var bucket_name = req.query.bucket_name;
    var object_name = req.query.object_name;

    function retrieveObject(params) {
        return new Promise(function(resolve, reject) {
            s3.getObject(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    var test = async function() {
        try {
            const ro_params = {
                Bucket: bucket_name,
                Key: `images/${object_name}.jpg`, // S3 경로
            };
            var data = await retrieveObject(ro_params);
            res.json({ image: data.Body });
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    // run the test
    test();
    // console.log(bucket_name);
    // console.log(object_name);
});

router.delete("/delete", function(req, res, next) {
    var bucket_name = req.query.bucket_name;
    var object_name = req.query.object_name;

    // Object Deletion 
    function deleteObject(params) {
        return new Promise(function(resolve, reject) {
            s3.deleteObject(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    var test = async function() {
        try {
            console.log('-- Delete an Object from the Bucket --');
            const do_params = {
                Bucket: bucket_name.toLowerCase(),
                Key: `images/${object_name.toLowerCase()}.jpg`, // S3 경로
            };
            var res6 = await deleteObject(do_params);

            // delete_image_db(bucket_name, object_name);
            // console.log(res6);
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    // run the test
    test();
});

async function delete_image_db(bucket_name, object_name) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/mongo';
    var queryParams = '?bucket_name=' + bucket_name + '&object_name=' + object_name;
    request({
        url: url + resource + queryParams,
        method: 'DELETE'
    }, function(error, response, body) {
        if (error) console.log(error);
        //console.log("바디" + body);
        //console.log("JSON.parse(body).result" + JSON.parse(body).result);
    });
}

router.delete("/delete_gateway", function(req, res, next) {
    var bucket_name = req.query.bucket_name;
    var object_name = req.query.object_name;

    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/image';
    var queryParams = '?bucket_name=' + bucket_name + '&object_name=' + object_name;
    console.log(url + resource + queryParams);
    request({
            url: url + resource + queryParams,
            method: 'DELETE',
        },
        function(error, response, body) {
            if (error) console.log(error);
            // console.log("JSON.parse(body).result" + JSON.parse(body).result);
            // console.log("body  " + body);
            delete_image_db(bucket_name, object_name);

            res.json({
                // new_data: JSON.parse(body).result
            });
        });
});

router.get("/list", function(req, res, next) {
    var bucket_name = req.query.bucket_name;

    function listObjects(params) {
        return new Promise(function(resolve, reject) {
            s3.listObjects(params, function(err, data) {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    var test = async function() {
        try {
            var cb_params = {
                Bucket: bucket_name.toLowerCase()
            };
            console.log('-- List the Objects in the Bucket --');
            var res4 = await listObjects(cb_params);
            console.log(res4.Contents);
            res.json(res4.Contents);
        } catch (err) {
            console.log('-- Error --');
            console.log(err);
        }
    }

    // run the test
    test();
});

router.get("/list_gateway", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/list-image';
    var queryParams = '?bucket_name=' + req.query.bucket_name;
    console.log("테스트" + url + resource + queryParams);
    request({
            url: url + resource + queryParams,
            method: 'GET',
        },
        function(error, response, body) {
            if (error) console.log(error);
            console.log("JSON.parse(body).result" + JSON.parse(body).result);
            // console.log("body  " + body.result);
            res.json({
                new_data: JSON.parse(body).result
            });
        });
});

router.get("/corona_status_gateway", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/corona-status';
    var queryParams = '?start=' + req.query.start + '&end=' + req.query.end;
    // console.log(url + resource + queryParams);
    request({
        url: url + resource + queryParams,
        method: 'GET'
    }, function(error, response, body) {
        if (error) console.log(error);
        // console.log("바디" + body);
        // console.log("JSON.parse(body).result" + JSON.parse(body).result);
        res.json({
            new_data: JSON.parse(body).result
        });
    });
});

router.get("/corona_city_gateway", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/corona-city';
    var queryParams = '?start=' + req.query.start + '&end=' + req.query.end;

    request({
        url: url + resource + queryParams,
        method: 'GET'
    }, function(error, response, body) {
        if (error) console.log(error);
        // console.log("바디" + body);
        // console.log("JSON.parse(body).result" + JSON.parse(body).result);
        res.json({
            new_data: JSON.parse(body).result
        });
    });
});

router.get("/corona_hospital_gateway", function(req, res, next) {
    var url = 'https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/3';
    var resource = '/corona-hospital';
    var queryParams = '?type=' + req.query.type;

    request({
        url: url + resource + queryParams,
        method: 'GET'
    }, function(error, response, body) {
        if (error) console.log(error);
        // console.log("바디" + body);
        console.log("JSON.parse(body).result" + JSON.parse(body).result);
        res.json({
            new_data: JSON.parse(body).result
        });
    });
});

module.exports = router;
