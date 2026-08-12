#include <QApplication>
#include <QCommandLineParser>
#include <QDir>
#include <QStandardPaths>

#include "AppMainWindow.h"
#include "ApiClient.h"
#include "AppState.h"

int main(int argc, char *argv[]) {
	QApplication app(argc, argv);
	app.setApplicationName("musicserver-qt");
	app.setOrganizationName("musicserver");

	QCommandLineParser parser;
	parser.addHelpOption();
	QCommandLineOption configOpt(QStringList() << "c" << "config",
	                             "Path to musicserver YAML config file",
	                             "path");
	parser.addOption(configOpt);
	parser.process(app);

	QString configPath = parser.value("config");
	if (configPath.isEmpty()) {
		configPath = QDir::homePath() + "/.config/musicserver.yaml";
	}

	ApiClient apiClient;
	if (!apiClient.initializeFromConfigFile(configPath)) {
		fprintf(stderr, "Failed to initialize backend from config: %s\n",
		        qPrintable(configPath));
		return 1;
	}

	AppMainWindow window(&apiClient);
	window.show();

	return app.exec();
}