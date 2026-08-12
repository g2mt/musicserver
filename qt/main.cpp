#include <QLabel>
#include <QMainWindow>
#include <QWidget>
#include <QApplication>

int main(int argc, char *argv[]) {
  QApplication app(argc, argv);

  QMainWindow window;
  window.setWindowTitle("musicserver");
  window.setCentralWidget(new QLabel("musicserver"));
  window.resize(800, 600);
  window.show();

  return app.exec();
}