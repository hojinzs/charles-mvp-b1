import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Crawler Server API",
      version: "1.0.0",
      description:
        "API documentation for the Naver Search Ranking Monitoring System",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Local server",
      },
    ],
  },
  apis: ["./src/api/routes/*.ts"], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export default specs;
