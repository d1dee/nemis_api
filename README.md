# **<u>UNOFFICIAL NEMIS API</u>**

This repository contains a set of API endpoints that interface with the National Education
Management Information System (NEMIS) in Kenya. The endpoints allow users to perform various
operations such as bulk admitting learners, bulk submitting learners to NHIF, transfer learners
between an institution and other functionalities supported on the NEMIS website.

## **Usage**

1. Ensure you have an instance of mongodb server running locally or get a free Atlas
   cluster [here](https://cloud.mongodb.com)
2. Clone the repository using `git clone https://github.com/d1dee/nemis_api.git`
3. Install dependencies using `npm install`
4. Set up environment variables by renaming `.env.example` to `.env` and edit the `.env` file to
   include the necessary variables.
5. Run the server using `npm start`.
