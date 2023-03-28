# **<u>UNOFFICIAL NEMIS API</u>**

This repository contains a set of API endpoints that interface with the National Education
Management Information System (NEMIS) in Kenya. The endpoints allow users to perform various
operations such as bulk admitting learners, bulk submitting learners to NHIF, transfer learners
between institution and other functionalities supported on the NEMIS website.

## **Usage**

1. Ensure you have an instance of mongodb server running locally or get a free Atlas
   cluster [here](https://cloud.mongodb.com)
2. Clone the repository using `git clone https://github.com/d1dee/nemis_api.git`
3. Install dependencies using `npm install`
4. Set up environment variables by renaming `.env.example` to `.env` and edit the .env file to
   include the necessary variables.
5. Run the server using `npm start`.

## **Endpoints**

`/api/auth/register`
> **`POST`** - This endpoint allows registration of new institutions to the API
>
> > **Body:**
> > ```js
> >  {
> >    username: "string",
> >    passwrod: "string"
> > }
> >

`/api/auth/refresh`
> **`GET`** - This endpoint refreshes JWT token if it has expired, else
> returns the same token.

`/api/institution`
> **`GET`** - Returns institution details stored in the database. Tis data is
> first scrapped from
> the  [Institution's bio-data page](http://nemis.education.go.ke/Institution/Institution.aspx)
>
> **`PATCH`** - Used to update institution information in the database
>
> > **Body:**
> > ```js
> > {
> >    username: "string",
> >    passwrod: "string"
> > }
> >
> **`DELETE`** - Deletes institution linked to the JWT token

`/api/learner`

> **`POST`** - Add a learners using json
>
> > **Body:**
> > ```js
> > [
> >     {
> >         adm:"string",
> >         name:"string",
> >         gender:"string",
> >         dob:"string",
> >         grade:"string",
> >         stream:"string",
> >         indexNo:"string",
> >         marks:"string",
> >         fatherName:"string",
> >         fatherId:"string",
> >         fatherTel:"string",
> >         motherName:"string",
> >         motherTel:"string",
> >         motherId:"string",
> >         guardianName:"string",
> >         guardianTel:"string",
> >         guardianId:"string",
> >         county:"string",
> >         subCounty:"string",
> >         kcpeYear:"string",
> >         continuing:"boolean"
> >         
> >     }
> > ]
> **`PUT`** - Add learners in bulk using an Excel file
>
> > Body
> > > `Content-Type: multipart/form-data`
> > >
> > > [Excel Template]()

`/api/learner/admit`
>
> **`GET`** - Returns admitted form 1
> learners [_without UPI_](http://nemis.education.go.ke/Admission/Listlearnersrep.aspx)
> or [_with UPI_](http://nemis.education.go.ke/Learner/Listlearners.aspx) as return from the NEMIS
> website.
>
> **`POST`** - Admit joining form one learners using [_this
page_](http://nemis.education.go.ke/Learner/Studindex.aspx)
>
`/api/learner/admit/capture`
>
> **`GET`** - This end point returns already captured learner. This end point differs from
> `/api/learner/admit` in that it returns api's record including errors encountered during the
> admission process.
>
> **`POST`** - Captures biodata for all joining form one learners in the database
>
>
`/api/learner/nhif/:grade`
>
> **`GET`** - By default this end point returns a list of all learners with or without nhif
> numbers. This behaviour can be changed by when calling with param `{nhif:true}` to return
> only learners with NHIF number or `nhif:false` to return those without NHIF numbers
>
> **`POST`** - Captures biodata for all joining form one learners in the database
>
`/api/learner/selected`
>
> **`GET`** - This end point returns learners selected to the institution, it is an exact list
> [_found here_](http://nemis.education.go.ke/Institution/schoolselectionlist.aspx)

`/api/learner/continuing`
> **`GET`** - Returns continuing learners, those who are awaiting approval and those awaiting bio
> data capture
>
> **`POST`** - Captures as continuing learner and submits bio data, _if the learner has been
> approved by NEMIS_, for all learners with `continuing` set to `true` in the database

`/api/learner/search?upi=${upiOrBirthCertificateNumber}`

> **`GET`** - This endpoint searches for learner details on NEMIS using their UPI or birth
> certificate number.

## Contributing

Contributions to this repository are welcome. If you would like to contribute, please create a pull
request.

## License

This repository is licensed under the MIT License. See LICENSE for more information.
