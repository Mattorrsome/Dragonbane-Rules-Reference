# One image: the API serves the Angular build from wwwroot, so the app and /api share an origin.

FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npx ng build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY src/Dragonbane.Api/Dragonbane.Api.csproj src/Dragonbane.Api/
RUN dotnet restore src/Dragonbane.Api
COPY src/Dragonbane.Api/ src/Dragonbane.Api/
# OpenAPI generation is a dev-time step for the web types; skip it here.
RUN dotnet publish src/Dragonbane.Api -c Release --no-restore -o /app -p:OpenApiGenerateDocuments=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY src/Dragonbane.Api/dragonbane.db ./
COPY --from=web /web/dist/web/browser ./wwwroot
# The aspnet image listens on 8080 (ASPNETCORE_HTTP_PORTS); render.yaml sets PORT to match.
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Dragonbane.Api.dll"]
