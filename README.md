# esb

The **esb** project provides functionality for writing and fetching data to/from EduAdmin, Fortnox, and other integrated systems. It also includes other boilerplate code.

## Features

- **Dynamic Processing Rules:** Allows dynamic configuration of processing rules for data transformation.
- **Data Transformation:** Transforms data from one format to another.
- **Sendinblue Integration:** Includes integration with Sendinblue for sending emails.
- **OAuth2.0 Support:** Includes support for OAuth2.0 authentication.
- **CORS Support:** Handles Cross-Origin Resource Sharing (CORS) to enable secure requests across different domains.
- **Simple GANTT API:** Includes a simple API for fetching GANTT data from EduAdmin.

## Getting Started

### Check if Firebase CLI is Installed

```sh
$ firebase --version
```

Install Firebase CLI

```sh
$ npm install -g firebase-tools
```

### DEPLOY INSTRUCTIONS

1. Check ENVIRONMENT firebase projects:list

2.

```sh
$ firebase use yoomi-esb-v1
$ firebase projects:list
```

3.

```sh
$ firebase deploy --only functions:

$ firebase serve --only functions,database
$ npm run-script lint
```

### SET AND GET CONFIG

- $ firebase functions:config:get
- $ firebase functions:config:set somekey.other.value="123456"
- $ firebase database:get /notes

Google Cloud Functions Cron Documentation

- https://firebase.google.com/docs/functions/schedule-functions
- https://cloud.google.com/scheduler/

## Contributing

Please contact me if you wish to contribute to the project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
