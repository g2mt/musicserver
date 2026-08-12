#include "ApiClient.h"
#include "TrackData.h"

#include <QtConcurrent>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>

extern "C" {
#include "libmusicserver.h"
}

ApiClient::ApiClient(QObject *parent) : QObject(parent) {}

ApiClient::~ApiClient() {
	if (m_ifaceHandle) {
		MsrvDeleteHandle(m_ifaceHandle);
	}
}

bool ApiClient::initializeFromConfigFile(const QString &configPath) {
	QByteArray utf8 = configPath.toUtf8();
	MsrvNewInterfaceResult res = MsrvNewInterfaceFromConfigFile(utf8.data());
	if (res.Err) {
		fprintf(stderr, "ApiClient::initializeFromConfigFile failed: %s\n", res.Err);
		free(res.Err);
		return false;
	}
	m_ifaceHandle = res.Handle;
	return true;
}

QFuture<QJsonDocument> ApiClient::handleRequest(const QString &path,
                                                const QString &method,
                                                const QJsonObject &params) {
	return QtConcurrent::run([this, path, method, params]() {
		return doRequest(path, method, params);
	});
}

QFuture<QJsonDocument> ApiClient::get(const QString &path,
                                      const QJsonObject &params) {
	return handleRequest(path, "GET", params);
}

QFuture<QJsonDocument> ApiClient::post(const QString &path,
                                       const QJsonObject &params) {
	return handleRequest(path, "POST", params);
}

QFuture<QJsonDocument> ApiClient::del(const QString &path,
                                      const QJsonObject &params) {
	return handleRequest(path, "DELETE", params);
}

QFuture<QJsonDocument> ApiClient::getProgress() {
	return get("/progress");
}

QFuture<TrackData> ApiClient::loadTrackByPath(const QString &encodedPath) {
	QString path = QString("/track/:by-path/%1").arg(encodedPath);
	return get(path).then([](const QJsonDocument &doc) -> TrackData {
		if (doc.isObject()) {
			QJsonObject obj = doc.object();
			if (obj.contains("error")) {
				fprintf(stderr, "loadTrackByPath error: %s\n",
				        qPrintable(obj["error"].toString()));
				return TrackData();
			}
			return TrackData::fromJson(obj);
		}
		return TrackData();
	});
}

QFuture<void> ApiClient::scanTracks(const QString &path, bool force) {
	QJsonObject params;
	if (!path.isEmpty()) params["path"] = path;
	if (force) params["force"] = "true";
	return post("/track", params).then([](const QJsonDocument &) {});
}

QJsonDocument ApiClient::doRequest(const QString &path,
                                   const QString &method,
                                   const QJsonObject &params) {
	QByteArray pathUtf8 = path.toUtf8();
	QByteArray methodUtf8 = method.toUtf8();
	QByteArray paramsJson;

	if (params.isEmpty()) {
		paramsJson = QByteArray("{}");
	} else {
		QJsonDocument doc(params);
		paramsJson = doc.toJson(QJsonDocument::Compact);
	}

	MsrvHandleRequestResult res = MsrvHandleRequest(
	    m_ifaceHandle, pathUtf8.data(), methodUtf8.data(), paramsJson.data());

	if (res.Err) {
		fprintf(stderr, "handleRequest error for %s: %s\n",
		        pathUtf8.data(), res.Err);
		free(res.Err);
		return QJsonDocument();
	}

	MsrvReadAllResult readRes = MsrvReadAll(res.ReaderHandle);
	MsrvDeleteHandle(res.ReaderHandle);

	if (readRes.Err) {
		fprintf(stderr, "readAll error for %s: %s\n", pathUtf8.data(),
		        readRes.Err);
		free(readRes.Err);
		return QJsonDocument();
	}

	if (!readRes.Data || readRes.N == 0) {
		return QJsonDocument();
	}

	QJsonParseError parseError;
	QJsonDocument doc = QJsonDocument::fromJson(
	    QByteArray(readRes.Data, readRes.N), &parseError);
	free(readRes.Data);

	if (parseError.error != QJsonParseError::NoError) {
		fprintf(stderr, "JSON parse error for %s: %s\n", pathUtf8.data(),
		        qPrintable(parseError.errorString()));
		return QJsonDocument();
	}

	return doc;
}