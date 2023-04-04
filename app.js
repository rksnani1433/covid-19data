const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db;

const server_database_connect = async () => {
  try {
    db = await open({ filename: dbpath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running http://localhost:3000/covid/");
    });
  } catch (error) {
    console.log(`DB error ${error.message}`);
    process.exit(1);
  }
};

server_database_connect();
//Authenticate token

const mid_authenticataion = (request, response, next) => {
  const authheaders = request.headers["authorization"];
  let jwtToken;
  if (authheaders !== undefined) {
    jwtToken = authheaders.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "my_secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log({ payload });
        request.username = payload;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//Log in the user into their account

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const usergetquery = ` SELECT * FROM user WHERE username = '${username}'`;
  const dbuser = await db.get(usergetquery);
  if (dbuser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const ismatch = bcrypt.compare(password, dbuser.password);
    if (ismatch) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my_secret");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get states

app.get("/states/", mid_authenticataion, async (request, response) => {
  const getquery = ` SELECT * FROM state `;
  const getstates = await db.all(getquery);
  const conv_camel = (query) => {
    return {
      stateId: query.state_id,
      stateName: query.state_name,
      population: query.population,
    };
  };
  response.send(getstates.map((each_s) => conv_camel(each_s)));
});

//based on id get states keyvalues

app.get("/states/:stateId/", mid_authenticataion, async (request, response) => {
  const { stateId } = request.params;
  const getbaseidquery = ` SELECT * FROM state WHERE state_id = ${stateId}`;
  const s_res = await db.get(getbaseidquery);
  const conv_camel = (each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  };
  response.send(conv_camel(s_res));
});

//districts total get

app.post("/districts/", mid_authenticataion, async (request, response) => {
  const { districtName, stateId, cases, active, deaths, cured } = request.body;
  const query_dis = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES  ('${districtName}', ${stateId}, ${cases},${cured}, ${active},${deaths} )
    `;
  const dis_res = await db.run(query_dis);
  response.send("District Successfully Added");
});

//districts based on id

app.get(
  "/districts/:districtId/",
  mid_authenticataion,
  async (request, response) => {
    const { districtId } = request.params;
    const getbaseidquery = ` SELECT * FROM district WHERE district_id = ${districtId}`;
    const s_res = await db.get(getbaseidquery);
    const conv_camel = (each) => {
      return {
        districtId: each.district_id,
        districtName: each.district_name,
        stateId: each.state_id,
        cases: each.cases,
        cured: each.cured,
        active: each.active,
        deaths: each.deaths,
      };
    };
    response.send(conv_camel(s_res));
  }
);

// delete district

app.delete(
  "/districts/:districtsId",
  mid_authenticataion,
  async (request, response) => {
    const { districtsId } = request.params;
    const del_query = ` DELETE FROM district WHERE district_id = ${districtsId}`;
    const del_res = await db.run(del_query);
    response.send("District Removed");
  }
);

//upate the district details

app.put(
  "/districts/:districtId/",
  mid_authenticataion,
  async (request, res) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const query = `
    UPDATE district SET district_name ='${districtName}',
    state_id = ${stateId},
    cases= ${cases},
    cured= ${cured},
    active= ${active},
    deaths= ${deaths}
    WHERE district_id = ${districtId}
    `;
    const r = await db.run(query);
    res.send("District Details Updated");
  }
);

app.get("/states/:stateId/stats/", mid_authenticataion, async (req, res) => {
  const { stateId } = req.params;
  const getq = ` 
    SELECT SUM(cases) as totalCases ,
     SUM(cured) as totalCured,
      SUM(active) as totalActive,
       SUM(deaths)as  totalDeaths
       FROM
       district
       WHERE state_id = ${stateId}
    `;
  const dbres = await db.get(getq);
  res.send(dbres);
});

module.exports = app;
